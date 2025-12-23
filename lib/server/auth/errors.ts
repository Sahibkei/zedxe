export class AppError extends Error {
    status: number;
    code: string;
    details?: unknown;

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
        this.name = "AppError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
