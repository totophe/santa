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

export type EditionState = 'open' | 'drawn' | 'archived';

@Table({ tableName: 'edition', timestamps: false, underscored: true })
export class Edition extends Model<
  InferAttributes<Edition>,
  InferCreationAttributes<Edition>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare groupId: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare name: string;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('generic')
  declare theme: CreationOptional<string>;

  @Attribute(DataTypes.DATEONLY)
  declare exchangeDate: string | null;

  @Attribute(DataTypes.TEXT)
  declare timezone: string | null;

  @Attribute(DataTypes.DECIMAL(12, 2))
  declare budgetAmount: string | null;

  @Attribute(DataTypes.TEXT)
  declare budgetCurrency: string | null;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('open')
  declare state: CreationOptional<EditionState>;

  @Attribute(DataTypes.DATE)
  declare drawnAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare chatOpenedAt: Date | null;

  @Attribute(DataTypes.INTEGER)
  declare noRepeatLookback: number | null;

  @Attribute(DataTypes.TEXT)
  declare inviteToken: string | null;

  @Attribute(DataTypes.DATE)
  declare archivedAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
