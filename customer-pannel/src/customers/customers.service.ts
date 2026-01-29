import {
  Injectable,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import type { CustomerModel as Customer } from '@/generated/prisma/models/Customer';
import { PaginatedResult } from '@shared/interfaces';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly repository: CustomersRepository) {}

  private generateCustomerId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CUST-${timestamp}-${random}`;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    this.logger.debug('Creating new customer');

    // Check if email already exists
    const emailExists = await this.repository.existsByEmail(dto.email);
    if (emailExists) {
      throw new ConflictException('Customer with this email already exists');
    }

    // Generate unique customerId with retry logic
    let customerId: string;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      customerId = this.generateCustomerId();
      const exists = await this.repository.existsByCustomerId(customerId);
      if (!exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique customer ID');
    }

    return this.repository.create({
      ...dto,
      customerId,
      subscriptionDate: dto.subscriptionDate ? new Date(dto.subscriptionDate) : undefined,
    });
  }

  async findAll(query: QueryCustomerDto): Promise<PaginatedResult<Customer>> {
    this.logger.debug(`Finding customers: page=${query.page}, limit=${query.limit}`);

    return this.repository.findWithPagination(
      { page: query.page, limit: query.limit },
      { orderBy: { createdAt: 'desc' } },
    );
  }

  async findOne(id: number): Promise<Customer> {
    this.logger.debug(`Finding customer with ID: ${id}`);
    return this.repository.findByIdOrThrow(id);
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    this.logger.debug(`Updating customer with ID: ${id}`);

    // Check if customer exists
    await this.repository.findByIdOrThrow(id);

    // Check email uniqueness if email is being updated
    if (dto.email) {
      const emailExists = await this.repository.existsByEmail(dto.email, id);
      if (emailExists) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    return this.repository.update(id, {
      ...dto,
      subscriptionDate: dto.subscriptionDate ? new Date(dto.subscriptionDate) : undefined,
    });
  }

  /**
   * Delete customer by ID
   */
  async remove(id: number): Promise<void> {
    this.logger.debug(`Deleting customer with ID: ${id}`);

    // Check if customer exists
    await this.repository.findByIdOrThrow(id);

    await this.repository.delete(id);
  }
}
