import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/config/prisma/prisma.service';
import { UnitOfWorkService } from '@shared/services/unit-of-work';
import { BaseRepository } from '@shared/repository/base.repository';
import type { CustomerModel as Customer } from '@/generated/prisma/models/Customer';

@Injectable()
export class CustomersRepository extends BaseRepository<Customer> {
  constructor(prisma: PrismaService, unitOfWork: UnitOfWorkService) {
    super(prisma, unitOfWork, 'customer');
  }

  async findByCustomerId(customerId: string): Promise<Customer | null> {
    return this.findOne({ customerId });
  }

  async existsByCustomerId(customerId: string): Promise<boolean> {
    const count = await this.count({ customerId });
    return count > 0;
  }

  async existsByEmail(email: string, excludeId?: number): Promise<boolean> {
    const where = excludeId
      ? { email, id: { not: excludeId } }
      : { email };
    const count = await this.count(where);
    return count > 0;
  }
}
