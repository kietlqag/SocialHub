export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const withStatus = (message, status = 400) => Object.assign(new Error(message), { status });
