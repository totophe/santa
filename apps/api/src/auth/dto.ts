import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

// First name / names that end up in emails reject URLs.
const NO_URL = /^(?!.*https?:\/\/)(?!.*www\.).*$/i;

export class SignInDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  sharedDevice?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  target?: string;
}

export class VerifyCodeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsBoolean()
  sharedDevice?: boolean;
}

export class ProfileDto {
  @IsString()
  @Length(1, 30)
  @Matches(NO_URL, { message: 'first name must not contain a URL' })
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(NO_URL, { message: 'last name must not contain a URL' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  language?: string;
}
