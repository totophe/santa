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

/** Single-row table holding the encryption key fingerprint. */
@Table({ tableName: 'instance_meta', timestamps: false, underscored: true })
export class InstanceMeta extends Model<
  InferAttributes<InstanceMeta>,
  InferCreationAttributes<InstanceMeta>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare keyFingerprint: string;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
