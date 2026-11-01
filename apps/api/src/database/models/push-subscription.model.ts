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

/** One Web Push subscription (a browser/device) for a user. */
@Table({ tableName: 'push_subscription', timestamps: false, underscored: true })
export class PushSubscription extends Model<
  InferAttributes<PushSubscription>,
  InferCreationAttributes<PushSubscription>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare userId: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare endpoint: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare p256dh: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare auth: string;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
