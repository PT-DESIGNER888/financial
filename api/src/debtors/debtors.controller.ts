import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DebtorsService } from './debtors.service';

class EmergencyContactDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() line?: string;
  @IsOptional() @IsString() note?: string;
}

class CreateDebtorDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() facebookUrl?: string;
  @IsOptional() @IsString() lineId?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];
}

class UpdateDebtorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() facebookUrl?: string;
  @IsOptional() @IsString() lineId?: string;
  @IsOptional() @IsString() relativeName?: string;
  @IsOptional() @IsString() relativePhone?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() blacklisted?: boolean;
  @IsOptional() @IsString() creditNote?: string;
  @IsOptional() @IsString() guarantorName?: string;
  @IsOptional() @IsString() guarantorPhone?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];
}

@Controller('debtors')
export class DebtorsController {
  constructor(private debtors: DebtorsService) {}

  @Get()
  findAll() {
    return this.debtors.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debtors.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDebtorDto) {
    return this.debtors.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDebtorDto) {
    return this.debtors.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.debtors.remove(id);
  }
}
