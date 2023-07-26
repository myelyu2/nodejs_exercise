/**
 * logger
 * Использует winston для записи важных событий и ошибок в m1.js и m2.js.
 * Эта конфигурация записывает сообщения как в консоль (в цветном упрощенном формате),
 * так и в файл под названием combined.log в формате JSON.
 */

const winston = require('winston');

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss'
		}),
		winston.format.errors({
			stack: true
		}),
		winston.format.splat(),
		winston.format.json()
	),
	defaultMeta: {
		service: 'user-service'
	},
	transports: [
		// Запись в консоль
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			)
		}),

		// Запись в файл
		new winston.transports.File({
			filename: 'combined.log'
		})
	]
});

module.exports = logger;