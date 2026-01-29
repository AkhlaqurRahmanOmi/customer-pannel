import { Body, Controller, HttpCode, Post, Req, UsePipes, ValidationPipe } from "@nestjs/common";
import type { Request } from "express";
import { ImportService } from "./import.service";
import { StartImportDto } from "./dto/start-import.dto";
import { ResponseBuilderService } from "@shared/services/response-builder.service";
import { TraceIdService } from "@shared/services/trace-id.service";

@Controller("customers")
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly responseBuilder: ResponseBuilderService,
    private readonly traceIdService: TraceIdService,
  ) {}


  @Post("sync")
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async startSync(@Body() dto: StartImportDto, @Req() req: Request) {
    const job = await this.importService.startImport(dto);
    return this.responseBuilder.buildSuccess(
      job,
      "Import job started",
      200,
      this.traceIdService.getOrGenerate(req.headers),
    );
  }
}
