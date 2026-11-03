import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsNumberString,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Text that ends up in emails rejects URLs.
const NO_URL = /^(?!.*https?:\/\/)(?!.*www\.).*$/i;

/** An unordered "these two must not draw each other" pair, by member user id. */
export class ExclusionPairDto {
  @IsUUID()
  a!: string;

  @IsUUID()
  b!: string;
}

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

  // Which active members take part. Omitted → everyone. (The creator is always in.)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  participantUserIds?: string[];

  // Couples etc. who must not draw each other, by member user id.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExclusionPairDto)
  exclusions?: ExclusionPairDto[];
}

export class FeasibilityDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  participantUserIds!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExclusionPairDto)
  exclusions?: ExclusionPairDto[];
}

/** A person invited to a group by email (name chosen by the inviting admin). */
export class InviteEntryDto {
  @IsString()
  @Length(1, 30)
  @Matches(NO_URL, { message: 'first name must not contain a URL' })
  firstName!: string;

  @IsEmail()
  email!: string;
}

export class InviteEmailsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InviteEntryDto)
  invites!: InviteEntryDto[];
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InviteEntryDto)
  invites?: InviteEntryDto[];
}

export class GroupSettingsDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  @Matches(NO_URL, { message: 'group name must not contain a URL' })
  name?: string;

  @IsOptional()
  @IsIn(['private', 'semi_public'])
  visibility?: string;
}
