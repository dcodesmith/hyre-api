// src/shared/decorators/zod-body.decorator.ts
import { Body, Param, Query } from "@nestjs/common";
import { ZodType } from "zod";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

export const ZodBody = <T>(schema: ZodType<T>) => Body(new ZodValidationPipe(schema));

// For other parameter types
export const ZodQuery = <T>(schema: ZodType<T>) => Query(new ZodValidationPipe(schema));

export const ZodParam = <T>(schema: ZodType<T>) => Param(new ZodValidationPipe(schema));
