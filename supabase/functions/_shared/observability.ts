// Shared observability utility for structured logging, request tracking, and performance monitoring

export interface LogMetadata {
  [key: string]: unknown;
  requestId?: string;
  functionName?: string;
  method?: string;
  path?: string;
  duration?: number;
  userId?: string;
  errorType?: string;
  errorMessage?: string;
  stack?: string;
}

export interface Logger {
  requestId: string;
  functionName: string;
  startTime: number;
  logInfo: (message: string, metadata?: LogMetadata) => void;
  logWarn: (message: string, metadata?: LogMetadata) => void;
  logError: (error: Error | unknown, metadata?: LogMetadata) => void;
  withTiming: <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
  getDuration: () => number;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: "info" | "warn" | "error",
  message: string,
  logger: Logger,
  metadata?: LogMetadata
): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    requestId: logger.requestId,
    functionName: logger.functionName,
    message,
    duration: logger.getDuration(),
    ...metadata,
  };

  // Use appropriate console method based on log level
  const logMessage = JSON.stringify(logEntry);
  
  switch (level) {
    case "info":
      console.log(logMessage);
      break;
    case "warn":
      console.warn(logMessage);
      break;
    case "error":
      console.error(logMessage);
      break;
  }
}

/**
 * Create a logger instance for a specific function
 */
export function createLogger(functionName: string, req?: Request): Logger {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  const url = req ? new URL(req.url) : null;
  const method = req?.method || "UNKNOWN";
  const path = url?.pathname || "UNKNOWN";

  const logger: Logger = {
    requestId,
    functionName,
    startTime,
    
    logInfo: (message: string, metadata?: LogMetadata) => {
      createLogEntry("info", message, logger, {
        method,
        path,
        ...metadata,
      });
    },
    
    logWarn: (message: string, metadata?: LogMetadata) => {
      createLogEntry("warn", message, logger, {
        method,
        path,
        ...metadata,
      });
    },
    
    logError: (error: Error | unknown, metadata?: LogMetadata) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      createLogEntry("error", errorObj.message, logger, {
        method,
        path,
        errorType: errorObj.constructor.name,
        errorMessage: errorObj.message,
        stack: errorObj.stack,
        ...metadata,
      });
    },
    
    withTiming: async <T>(operation: () => Promise<T>, operationName: string): Promise<T> => {
      const operationStart = Date.now();
      try {
        const result = await operation();
        const operationDuration = Date.now() - operationStart;
        logger.logInfo(`Operation completed: ${operationName}`, {
          operationName,
          operationDuration,
        });
        return result;
      } catch (error) {
        const operationDuration = Date.now() - operationStart;
        logger.logError(error as Error, {
          operationName,
          operationDuration,
        });
        throw error;
      }
    },
    
    getDuration: () => {
      return Date.now() - startTime;
    },
  };

  // Log function entry
  logger.logInfo("Function invoked", {
    method,
    path,
  });

  return logger;
}

/**
 * Helper to extract user ID from JWT payload or request context
 */
export function extractUserId(payload: { sub?: string } | null): string | undefined {
  return payload?.sub;
}

