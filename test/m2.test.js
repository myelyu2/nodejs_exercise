const chai = require('chai');
const sinon = require('sinon');
const amqplib = require('amqplib');

// Убедимся, что m2.js экспортирует функцию startWorker
const { startWorker } = require('../src/m2');

const { expect } = chai;

describe('Сервис M2', () => {
    let connectStub;
    let channelStub;

    beforeEach(() => {
        // Эмулирование методов для канала
        channelStub = {
            assertQueue: sinon.stub(),
            consume: sinon.stub(),
            sendToQueue: sinon.stub(),
            ack: sinon.stub(),
            nack: sinon.stub()
        };
        
        // Эмулирование соединения с RabbitMQ
        connectStub = sinon.stub(amqplib, 'connect').resolves({
            createChannel: sinon.stub().resolves(channelStub)
        });
    });

    afterEach(() => {
        // Восстановить оригинальный метод соединения RabbitMQ после каждого теста
        connectStub.restore();
    });

    it('должен обрабатывать корректную задачу и отправлять результат', async () => {
        // Определение имитационной задачи
        const mockTask = { data: 'test' };

        // Эмулирование вызова метода 'consume' с нашей имитационной задачей
        channelStub.consume.callsArgWith(1, {
            content: Buffer.from(JSON.stringify(mockTask)),
            properties: { correlationId: 'test-id' }
        });

        // Запуск рабочего процесса, который затем должен обработать нашу имитационную задачу
        await startWorker();

        // Утверждения, чтобы убедиться, что результат был отправлен в 'results_queue' и сообщение было подтверждено
        sinon.assert.calledOnce(channelStub.sendToQueue);
        sinon.assert.calledWith(channelStub.sendToQueue, 'results_queue', sinon.match.any, { correlationId: 'test-id' });
        sinon.assert.calledOnce(channelStub.ack);
    });

    it('должен отрицательно подтвердить некорректную задачу', async () => {
        // Эмулирование вызова метода 'consume' с недопустимым содержимым
        channelStub.consume.callsArgWith(1, { content: Buffer.from('not-a-valid-json') });

        // Запуск рабочего процесса, который затем должен обработать некорректное содержимое
        await startWorker();

        // Утверждение, чтобы убедиться, что недопустимое содержимое получило отрицательное подтверждение
        sinon.assert.calledOnce(channelStub.nack);
    });
});
