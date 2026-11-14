import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function parsePositiveDecimal(value: string, message: string): Prisma.Decimal {
  const decimal = parseDecimal(value, message);
  if (decimal.lte(0)) throw new BadRequestException(message);
  return decimal;
}

export function parseNonNegativeDecimal(value: string, message: string): Prisma.Decimal {
  return parseDecimal(value, message);
}

function parseDecimal(value: string, message: string): Prisma.Decimal {
  const trimmed = value.trim();
  if (!DECIMAL.test(trimmed)) throw new BadRequestException(message);
  return new Prisma.Decimal(trimmed);
}
