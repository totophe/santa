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

/**
 * One row per giver. The recipient is encrypted; there are deliberately NO
 * timestamps, because in a single loop insertion order would spell out the
 * chain. Rows are inserted in shuffled order.
 */
@Table({ tableName: 'assignment', timestamps: false, underscored: true })
export class Assignment extends Model<
  InferAttributes<Assignment>,
  InferCreationAttributes<Assignment>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare editionId: string;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare giverParticipantId: string;

  @Attribute(DataTypes.BLOB)
  @NotNull
  declare recipientCiphertext: Buffer;

  @Attribute(DataTypes.BLOB)
  @NotNull
  declare nonce: Buffer;
}
