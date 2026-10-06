import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class AddItemDto {
  @IsString()
  @Length(1, 200)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  price?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class PasteDto {
  // Each non-empty line becomes an item.
  @IsString()
  @MaxLength(20000)
  text!: string;
}

export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  itemIds!: string[];
}

export class ImportDto {
  @IsUUID()
  sourceWishlistId!: string;

  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  itemIds!: string[];
}
