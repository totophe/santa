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

@Table({ tableName: 'email_suppression', timestamps: false, underscored: true })
export class EmailSuppression extends Model<
  InferAttributes<EmailSuppression>,
  InferCreationAttributes<EmailSuppression>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Unique
  declare emailHash: string;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
