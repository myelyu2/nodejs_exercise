const amqplib = require('amqplib');
const logger = require('./logger');

const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'

/**
 * Обработать заданную задачу.
 * @param {Object} task - Задача для обработки.
 * @returns {Object} - Обработанная задача.
 */
async function processTask(task) {
    // Эмуляция обработки
    task.processed = true;
    return task;
}

/**
 * Создает и возвращает канал RabbitMQ.
 * @returns {Object} - Канал RabbitMQ.
 */
async function createRabbitMQChannel() {
    const connection = await amqplib.connect(`amqp://${rabbitmqHost}`).catch(err => {
        throw new Error(`Не удалось подключиться к RabbitMQ: ${err.message}`);
    });

    const channel = await connection.createChannel().catch(err => {
        throw new Error(`Не удалось создать канал: ${err.message}`);
    });

    return channel;
}

/**
 * Основная функция для запуска работника и обработки задач.
 */
async function startWorker() {
    let channel;
    try {
        channel = await createRabbitMQChannel();
    } catch (error) {
        logger.error(error.message);
        return;
    }

    try {
        const queueName = 'http_queue';
        await channel.assertQueue(queueName);

        // Обработать входящие сообщения из http_queue
        channel.consume(queueName, async (msg) => {
            if (!msg) {
                logger.warn('Получено неопределенное сообщение из http_queue');
                return;
            }

            let task;
            try {
                task = JSON.parse(msg.content.toString());

            } catch (err) {
                logger.error(`Не удалось разобрать содержимое сообщения: ${err.message}`);
                channel.nack(msg); // Отрицательное подтверждение сообщения.
                return;
            }

            const result = await processTask(task);

            // Отправить результат обработанной задачи обратно в очередь результатов
            channel.sendToQueue('results_queue', Buffer.from(JSON.stringify(result)), {
                correlationId: msg.properties.correlationId
            });
            channel.ack(msg); // Подтверждение обработанного сообщения.
        });
    } catch (error) {
        logger.error(`Не удалось запустить работника: ${error.message}`);
    }
}

startWorker();
module.exports = {
    startWorker
};
