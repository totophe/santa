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

export type ThreadRole = 'santa' | 'recipient';

/**
 * A private-thread message. Payloads carry a role (santa/recipient), never the
 * other party's id. The author is not stored beyond the role.
 */
@Table({ tableName: 'thread_message', timestamps: false, underscored: true })
export class ThreadMessage extends Model<
  InferAttributes<ThreadMessage>,
  InferCreationAttributes<ThreadMessage>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare threadId: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare fromRole: ThreadRole;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare body: string;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
