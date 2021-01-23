import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('Customer does not exist.');
    }

    const checkProductExists = await this.productsRepository.findAllById(
      products,
    );

    if (!checkProductExists.length) {
      throw new AppError('Product does not exist.');
    }

    const existentProductsIds = checkProductExists.map(product => product.id);

    const checkInexistentProductsIds = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistentProductsIds.length) {
      throw new AppError(
        `Product ${checkInexistentProductsIds[0].id} does not exist.`,
      );
    }

    const productsWithoutQuantityAvailable = products.filter(
      product =>
        checkProductExists.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsWithoutQuantityAvailable.length) {
      throw new AppError(
        `Product ${productsWithoutQuantityAvailable[0].id} does not have enough quantity.`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkProductExists.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        checkProductExists.filter(p => p.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
