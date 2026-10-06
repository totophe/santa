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

@Table({ tableName: 'session', timestamps: false, underscored: true })
export class Session extends Model<
  InferAttributes<Session>,
  InferCreationAttributes<Session>
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
  declare tokenHash: string;

  @Attribute(DataTypes.BOOLEAN)
  @NotNull
  @Default(true)
  declare persistent: CreationOptional<boolean>;

  @Attribute(DataTypes.DATE)
  @NotNull
  declare expiresAt: Date;

  @Attribute(DataTypes.DATE)
  declare lastUsedAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
