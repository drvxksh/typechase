import winston from "winston";

export class LoggingService {
  private static instance: LoggingService;
  private logger: winston.Logger;

  private constructor() {
    const { combine, timestamp, printf, colorize, align } = winston.format;

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: combine(
        colorize({ all: true }),
        timestamp({
          format: "YYYY-MM-DD hh:mm:ss.SSS A",
        }),
        align(),
        printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`),
      ),
      transports: [new winston.transports.Console()],
    });
  }

  public static getInstance() {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }

    return LoggingService.instance;
  }

  public info(message: string) {
    this.logger.info(message);
  }

  public warn(message: string) {
    this.logger.warn(message);
  }

  public error(message: string) {
    this.logger.error(message);
  }

  public verbose(message: string) {
    this.logger.verbose(message);
  }
}
