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

@Table({ tableName: 'user', timestamps: false, underscored: true })
export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare email: string;

  @Attribute(DataTypes.TEXT)
  declare firstName: string | null;

  @Attribute(DataTypes.TEXT)
  declare lastName: string | null;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('en')
  declare language: CreationOptional<string>;

  @Attribute(DataTypes.DATE)
  declare lastSeenAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
