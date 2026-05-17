import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceCategoriesController } from './finance-categories.controller';
import { FinanceCategoriesService } from './finance-categories.service';

@Module({
  controllers: [FinanceController, FinanceCategoriesController],
  providers: [FinanceService, FinanceCategoriesService],
  exports: [FinanceService, FinanceCategoriesService],
})
export class FinanceModule {}
