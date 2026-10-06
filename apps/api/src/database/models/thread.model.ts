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

/** One private thread per recipient, created at the draw. */
@Table({ tableName: 'thread', timestamps: false, underscored: true })
export class Thread extends Model<
  InferAttributes<Thread>,
  InferCreationAttributes<Thread>
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
  @Unique
  declare recipientParticipantId: string;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
