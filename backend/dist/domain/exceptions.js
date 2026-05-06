"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenException = exports.UnauthorizedException = exports.NotFoundException = exports.DomainException = void 0;
class DomainException extends Error {
    message;
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.name = 'DomainException';
    }
}
exports.DomainException = DomainException;
class NotFoundException extends DomainException {
    constructor(message) {
        super(message, 404);
        this.name = 'NotFoundException';
    }
}
exports.NotFoundException = NotFoundException;
class UnauthorizedException extends DomainException {
    constructor(message) {
        super(message, 401);
        this.name = 'UnauthorizedException';
    }
}
exports.UnauthorizedException = UnauthorizedException;
class ForbiddenException extends DomainException {
    constructor(message) {
        super(message, 403);
        this.name = 'ForbiddenException';
    }
}
exports.ForbiddenException = ForbiddenException;
