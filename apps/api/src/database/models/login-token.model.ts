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

export type LoginPurpose = 'sign_in' | 'action';

@Table({ tableName: 'login_token', timestamps: false, underscored: true })
export class LoginToken extends Model<
  InferAttributes<LoginToken>,
  InferCreationAttributes<LoginToken>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare email: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare codeHash: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare linkTokenHash: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare purpose: LoginPurpose;

  @Attribute(DataTypes.TEXT)
  declare target: string | null;

  @Attribute(DataTypes.DATE)
  @NotNull
  declare expiresAt: Date;

  @Attribute(DataTypes.INTEGER)
  @NotNull
  @Default(0)
  declare attempts: CreationOptional<number>;

  @Attribute(DataTypes.DATE)
  declare usedAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
