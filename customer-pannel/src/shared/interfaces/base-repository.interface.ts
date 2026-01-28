/**
 * Base repository interface for common CRUD operations
 */
export interface IBaseRepository<T> {
  create(data: any): Promise<T>;
  findById(id: string | number): Promise<T | null>;
  findAll(options?: FindAllOptions): Promise<T[]>;
  update(id: string | number, data: any): Promise<T>;
  delete(id: string | number): Promise<T>;
  count(where?: any): Promise<number>;
}

/**
 * Options for findAll method
 */
export interface FindAllOptions {
  where?: any;
  select?: any;
  include?: any;
  orderBy?: any;
  skip?: number;
  take?: number;
}
