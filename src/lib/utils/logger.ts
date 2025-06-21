import { DEBUG_CONFIG } from '../contracts/config';

type LogLevel = keyof typeof DEBUG_CONFIG.LOG_LEVELS;

class Logger {
  private enabled = DEBUG_CONFIG.ENABLE_CONSOLE_LOGS;

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    console[DEBUG_CONFIG.LOG_LEVELS[level]](prefix, message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log('ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('WARN', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('INFO', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.log('DEBUG', message, ...args);
  }

  // Specialized methods for contract operations
  contractCall(contractName: string, method: string, args?: any[]) {
    this.debug(`Contract call: ${contractName}.${method}`, args);
  }

  contractResult(contractName: string, method: string, result: any) {
    this.debug(`Contract result: ${contractName}.${method}`, result);
  }

  contractError(contractName: string, method: string, error: any) {
    this.error(`Contract error: ${contractName}.${method}`, error);
  }
}

export const logger = new Logger();
