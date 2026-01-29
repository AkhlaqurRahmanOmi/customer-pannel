import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ResponseBuilderService } from '@shared/services/response-builder.service';
import { TraceIdService } from '@shared/services/trace-id.service';

@Controller('customers')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly responseBuilder: ResponseBuilderService,
    private readonly traceIdService: TraceIdService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    const customer = await this.customersService.create(dto);
    return this.responseBuilder.buildSuccess(
      customer,
      'Customer created successfully',
      HttpStatus.CREATED,
      this.traceIdService.getOrGenerate(req.headers),
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryCustomerDto, @Req() req: Request) {
    const result = await this.customersService.findAll(query);
    return this.responseBuilder.buildSuccess(
      result,
      'Customers retrieved successfully',
      HttpStatus.OK,
      this.traceIdService.getOrGenerate(req.headers),
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const customer = await this.customersService.findOne(id);
    return this.responseBuilder.buildSuccess(
      customer,
      'Customer retrieved successfully',
      HttpStatus.OK,
      this.traceIdService.getOrGenerate(req.headers),
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    const customer = await this.customersService.update(id, dto);
    return this.responseBuilder.buildSuccess(
      customer,
      'Customer updated successfully',
      HttpStatus.OK,
      this.traceIdService.getOrGenerate(req.headers),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    await this.customersService.remove(id);
    return this.responseBuilder.buildSuccess(
      { id },
      'Customer deleted successfully',
      HttpStatus.OK,
      this.traceIdService.getOrGenerate(req.headers),
    );
  }
}
