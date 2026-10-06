import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsNumberString,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Text that ends up in emails rejects URLs.
const NO_URL = /^(?!.*https?:\/\/)(?!.*www\.).*$/i;

export class EditionInputDto {
  @IsString()
  @Length(1, 40)
  @Matches(NO_URL, { message: 'edition name must not contain a URL' })
  name!: string;

  @IsOptional()
  @IsIn(['generic', 'santa'])
  theme?: string;

  @IsOptional()
  @IsISO8601()
  exchangeDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsNumberString()
  budgetAmount?: string;

  @IsOptional()
  @IsString()
  @Length(1, 8)
  budgetCurrency?: string;
}

export class CreateGroupDto {
  @IsString()
  @Length(1, 60)
  @Matches(NO_URL, { message: 'group name must not contain a URL' })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  defaultLanguage?: string;

  @ValidateNested()
  @Type(() => EditionInputDto)
  edition!: EditionInputDto;
}
