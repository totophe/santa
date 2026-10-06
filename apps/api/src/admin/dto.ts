import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const NO_URL = /^(?!.*https?:\/\/)(?!.*www\.).*$/i;

export class TypedInviteDto {
  @IsString()
  @Length(1, 30)
  @Matches(NO_URL, { message: 'first name must not contain a URL' })
  firstName!: string;

  @IsEmail()
  email!: string;
}

export class SetRoleDto {
  @IsIn(['member', 'admin'])
  role!: 'member' | 'admin';
}

export class DeleteGroupDto {
  @IsString()
  @MaxLength(60)
  confirmName!: string;
}

export class EditionSettingsDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(NO_URL, { message: 'edition name must not contain a URL' })
  name?: string;

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

  @IsOptional()
  @IsIn(['generic', 'santa'])
  theme?: string;
}
