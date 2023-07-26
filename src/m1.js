const express = require('express');
const bodyParser = require('body-parser');
const amqplib = require('amqplib');
const {
	v4: uuidv4
} = require('uuid');
const logger = require('./logger');

const app = express();
app.use(bodyParser.json());

const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'

// Хранение результатов, полученных от M2
const resultsStore = {};

let globalChannel;

// Установить соединение с RabbitMQ и настроить очередь результатов
async function connectToMQ() {
	if (globalChannel) {
		return; // Выход, если соединение уже установлено
	}

	try {
		const connection = await amqplib.connect(`amqp://${rabbitmqHost}`);
		globalChannel = await connection.createChannel();

		// Настроить очередь для прослушивания результатов от M2
		const resultsQueue = 'results_queue';
		await globalChannel.assertQueue(resultsQueue);

		globalChannel.consume(resultsQueue, (msg) => {
			if (!msg) {
				logger.warn('Получено неопределенное сообщение из results_queue');
				return;
			}

			const correlationId = msg.properties.correlationId;
			resultsStore[correlationId] = msg.content.toString();
			globalChannel.ack(msg);
		});
	} catch (error) {
		logger.error("Не удалось подключиться к RabbitMQ:", error);
		throw error;
	}
}

// Отправить данные в RabbitMQ для обработки и вернуть correlation ID
async function sendToRabbitMQ(data) {
	if (!globalChannel) {
		throw new Error('Канал RabbitMQ не инициализирован');
	}

	const correlationId = uuidv4();
	const queueName = 'http_queue';
	await globalChannel.assertQueue(queueName);
	globalChannel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
		correlationId
	});

	return correlationId;
}

// Точка входа для обработки входящих данных
app.post('/process', async (req, res) => {
	try {
		const correlationId = await sendToRabbitMQ(req.body);
		res.json({
			id: correlationId
		});
	} catch (error) {
		logger.error(`Не удалось обработать запрос: ${error.message}`);
		res.status(500).send({
			message: 'Внутренняя ошибка сервера'
		});
	}
});

// Точка входа для получения результатов на основе correlation ID
app.get('/results/:id', (req, res) => {
	const result = resultsStore[req.params.id];
	if (!result) {
		return res.status(404).send({
			message: 'Результат не найден или все еще обрабатывается'
		});
	}
	res.json(JSON.parse(result));
});

// Запустить сервер после установления соединения с RabbitMQ
async function startServer() {
	await connectToMQ();
	const PORT = 3000;
	app.listen(PORT, () => {
		logger.info(`Сервис M1 запущен по адресу http://localhost:${PORT}`);
	});
}

if (!process.env.TEST) {
	startServer();
}

module.exports = {
	app,
	startServer,
	globalChannel,
	connectToMQ
}
