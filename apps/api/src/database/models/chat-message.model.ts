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
 * A group-chat message. The author is the alias only — payloads carry an alias
 * key, never a participant or user id. System messages have a null alias and a
 * systemKind instead of a body.
 */
@Table({ tableName: 'chat_message', timestamps: false, underscored: true })
export class ChatMessage extends Model<
  InferAttributes<ChatMessage>,
  InferCreationAttributes<ChatMessage>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare editionId: string;

  @Attribute(DataTypes.TEXT)
  declare aliasKey: string | null;

  @Attribute(DataTypes.TEXT)
  declare systemKind: string | null;

  @Attribute(DataTypes.TEXT)
  declare body: string | null;

  @Attribute(DataTypes.DATE)
  declare deletedAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
