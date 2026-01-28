import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/config/prisma/prisma.service';
import { UnitOfWorkService } from '@shared/services/unit-of-work';
import {
  IBaseRepository,
  FindAllOptions,
  PaginatedResult,
  PaginationMeta,
  PaginationOptions,
} from '@shared/interfaces';

/**
 * Base repository class with common CRUD operations
 * @template T - Entity type
 */
@Injectable()
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly unitOfWork: UnitOfWorkService,
    protected readonly modelName: string,
  ) {
    this.logger = new Logger(`${modelName}Repository`);
  }

  /**
   * Get the Prisma model delegate
   */
  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Create a new record
   * @param data - Data to create the record
   * @returns Created record
   */
  async create(data: any): Promise<T> {
    try {
      this.logger.debug(`Creating ${this.modelName}`);
      const result = await this.model.create({ data });
      this.logger.debug(`${this.modelName} created successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error creating ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new record within a transaction
   * @param data - Data to create the record
   * @returns Created record
   */
  async createInTransaction(data: any): Promise<T> {
    return this.unitOfWork.transaction(async (tx) => {
      this.logger.debug(`Creating ${this.modelName} in transaction`);
      const result = await (tx as any)[this.modelName].create({ data });
      this.logger.debug(`${this.modelName} created successfully in transaction`);
      return result;
    });
  }

  /**
   * Find a record by ID
   * @param id - Record ID
   * @param select - Fields to select
   * @param include - Relations to include
   * @returns Found record or null
   */
  async findById(
    id: string | number,
    select?: any,
    include?: any,
  ): Promise<T | null> {
    try {
      this.logger.debug(`Finding ${this.modelName} by ID: ${id}`);
      const result = await this.model.findUnique({
        where: { id },
        ...(select && { select }),
        ...(include && { include }),
      });
      return result;
    } catch (error) {
      this.logger.error(`Error finding ${this.modelName} by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find a record by ID or throw NotFoundException
   * @param id - Record ID
   * @param select - Fields to select
   * @param include - Relations to include
   * @returns Found record
   * @throws NotFoundException if record not found
   */
  async findByIdOrThrow(
    id: string | number,
    select?: any,
    include?: any,
  ): Promise<T> {
    const result = await this.findById(id, select, include);
    if (!result) {
      throw new NotFoundException(`${this.modelName} with ID ${id} not found`);
    }
    return result;
  }

  /**
   * Find all records with optional filters
   * @param options - Query options (where, select, include, orderBy, skip, take)
   * @returns Array of records
   */
  async findAll(options?: FindAllOptions): Promise<T[]> {
    try {
      this.logger.debug(`Finding all ${this.modelName}`);
      const result = await this.model.findMany(options);
      return result;
    } catch (error) {
      this.logger.error(`Error finding all ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find records with pagination
   * @param options - Pagination options
   * @param queryOptions - Query options (where, select, include, orderBy)
   * @returns Paginated result with data and metadata
   */
  async findWithPagination(
    options: PaginationOptions,
    queryOptions?: Omit<FindAllOptions, 'skip' | 'take'>,
  ): Promise<PaginatedResult<T>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      this.logger.debug(`Finding ${this.modelName} with pagination: page ${page}, limit ${limit}`);

      const [data, totalItems] = await Promise.all([
        this.model.findMany({
          ...queryOptions,
          skip,
          take: limit,
        }),
        this.model.count({ where: queryOptions?.where }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      const pagination: PaginationMeta = {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      return { data, pagination };
    } catch (error) {
      this.logger.error(`Error finding ${this.modelName} with pagination: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find one record by custom filter
   * @param where - Filter condition
   * @param select - Fields to select
   * @param include - Relations to include
   * @returns Found record or null
   */
  async findOne(where: any, select?: any, include?: any): Promise<T | null> {
    try {
      this.logger.debug(`Finding one ${this.modelName}`);
      const result = await this.model.findFirst({
        where,
        ...(select && { select }),
        ...(include && { include }),
      });
      return result;
    } catch (error) {
      this.logger.error(`Error finding one ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param id - Record ID
   * @param data - Data to update
   * @returns Updated record
   */
  async update(id: string | number, data: any): Promise<T> {
    try {
      this.logger.debug(`Updating ${this.modelName} with ID: ${id}`);
      const result = await this.model.update({
        where: { id },
        data,
      });
      this.logger.debug(`${this.modelName} updated successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a record by ID within a transaction
   * @param id - Record ID
   * @param data - Data to update
   * @returns Updated record
   */
  async updateInTransaction(id: string | number, data: any): Promise<T> {
    return this.unitOfWork.transaction(async (tx) => {
      this.logger.debug(`Updating ${this.modelName} with ID: ${id} in transaction`);
      const result = await (tx as any)[this.modelName].update({
        where: { id },
        data,
      });
      this.logger.debug(`${this.modelName} updated successfully in transaction`);
      return result;
    });
  }

  /**
   * Delete a record by ID
   * @param id - Record ID
   * @returns Deleted record
   */
  async delete(id: string | number): Promise<T> {
    try {
      this.logger.debug(`Deleting ${this.modelName} with ID: ${id}`);
      const result = await this.model.delete({
        where: { id },
      });
      this.logger.debug(`${this.modelName} deleted successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a record by ID within a transaction
   * @param id - Record ID
   * @returns Deleted record
   */
  async deleteInTransaction(id: string | number): Promise<T> {
    return this.unitOfWork.transaction(async (tx) => {
      this.logger.debug(`Deleting ${this.modelName} with ID: ${id} in transaction`);
      const result = await (tx as any)[this.modelName].delete({
        where: { id },
      });
      this.logger.debug(`${this.modelName} deleted successfully in transaction`);
      return result;
    });
  }

  /**
   * Soft delete a record by ID (sets deletedAt timestamp)
   * Note: Only works if your model has a deletedAt field
   * @param id - Record ID
   * @returns Updated record
   */
  async softDelete(id: string | number): Promise<T> {
    try {
      this.logger.debug(`Soft deleting ${this.modelName} with ID: ${id}`);
      const result = await this.model.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      this.logger.debug(`${this.modelName} soft deleted successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error soft deleting ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Count records matching filter
   * @param where - Filter condition
   * @returns Count of matching records
   */
  async count(where?: any): Promise<number> {
    try {
      this.logger.debug(`Counting ${this.modelName}`);
      const result = await this.model.count({ where });
      return result;
    } catch (error) {
      this.logger.error(`Error counting ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a record exists by ID
   * @param id - Record ID
   * @returns True if exists, false otherwise
   */
  async exists(id: string | number): Promise<boolean> {
    const count = await this.count({ id });
    return count > 0;
  }

  /**
   * Bulk create records
   * @param data - Array of data to create
   * @param skipDuplicates - Skip duplicate records
   * @returns Created records count
   */
  async createMany(
    data: any[],
    skipDuplicates = false,
  ): Promise<{ count: number }> {
    try {
      this.logger.debug(`Bulk creating ${data.length} ${this.modelName} records`);
      const result = await this.model.createMany({ data, skipDuplicates });
      this.logger.debug(`${result.count} ${this.modelName} records created successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error bulk creating ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk update records
   * @param where - Filter condition
   * @param data - Data to update
   * @returns Updated records count
   */
  async updateMany(where: any, data: any): Promise<{ count: number }> {
    try {
      this.logger.debug(`Bulk updating ${this.modelName} records`);
      const result = await this.model.updateMany({ where, data });
      this.logger.debug(`${result.count} ${this.modelName} records updated successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error bulk updating ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk delete records
   * @param where - Filter condition
   * @returns Deleted records count
   */
  async deleteMany(where: any): Promise<{ count: number }> {
    try {
      this.logger.debug(`Bulk deleting ${this.modelName} records`);
      const result = await this.model.deleteMany({ where });
      this.logger.debug(`${result.count} ${this.modelName} records deleted successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error bulk deleting ${this.modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a custom transaction with multiple operations
   * @param callback - Transaction callback
   * @returns Transaction result
   */
  async executeTransaction<R>(
    callback: (tx: any) => Promise<R>,
  ): Promise<R> {
    return this.unitOfWork.transaction(callback);
  }

  /**
   * Execute a transaction with automatic retry on retryable errors
   * @param callback - Transaction callback
   * @param maxRetries - Maximum number of retries
   * @returns Transaction result
   */
  async executeTransactionWithRetry<R>(
    callback: (tx: any) => Promise<R>,
    maxRetries = 3,
  ): Promise<R> {
    return this.unitOfWork.executeWithRetry(callback, maxRetries);
  }
}
