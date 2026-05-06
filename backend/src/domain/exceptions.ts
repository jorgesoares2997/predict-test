export class DomainException extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'DomainException';
  }
}

export class NotFoundException extends DomainException {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundException';
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message: string) {
    super(message, 401);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends DomainException {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ForbiddenException';
  }
}
