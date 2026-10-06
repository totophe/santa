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
  Default,
  Table,
} from '@sequelize/core/decorators-legacy';

@Table({ tableName: 'wishlist_item', timestamps: false, underscored: true })
export class WishlistItem extends Model<
  InferAttributes<WishlistItem>,
  InferCreationAttributes<WishlistItem>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare wishlistId: string;

  @Attribute(DataTypes.INTEGER)
  @NotNull
  @Default(0)
  declare position: CreationOptional<number>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare text: string;

  @Attribute(DataTypes.TEXT)
  declare url: string | null;

  @Attribute(DataTypes.TEXT)
  declare price: string | null;

  @Attribute(DataTypes.TEXT)
  declare note: string | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
