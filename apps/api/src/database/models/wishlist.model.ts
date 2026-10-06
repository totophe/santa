import {
  Model,
  DataTypes,
  sql,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from '@sequelize/core';
import {
  Attribute,
  PrimaryKey,
  NotNull,
  Unique,
  Default,
  Table,
} from '@sequelize/core/decorators-legacy';

export type WishlistState = 'draft' | 'published' | 'surprise';

@Table({ tableName: 'wishlist', timestamps: false, underscored: true })
export class Wishlist extends Model<
  InferAttributes<Wishlist>,
  InferCreationAttributes<Wishlist>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  @Unique
  declare participantId: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('draft')
  declare state: CreationOptional<WishlistState>;

  @Attribute(DataTypes.DATE)
  declare publishedAt: Date | null;

  @Attribute(DataTypes.DATE)
  @NotNull
  declare updatedAt: CreationOptional<Date>;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
