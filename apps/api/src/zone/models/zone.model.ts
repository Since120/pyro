import { Field, ObjectType, InputType, ID } from '@nestjs/graphql';
import { Category } from '../../category/models/category.model';

/**
 * Basis Zone Entity
 * Die zentrale Quelle der Wahrheit für den Zone-Typ
 */
@ObjectType({ description: 'Discord-Zone Repräsentation' })
export class Zone {
  @Field(() => ID, { description: 'Eindeutige Zone ID' })
  id: string;

  @Field({ description: 'Kurzes Kürzel für die Zone, z.B. "CZ" für Contested Zone' })
  zoneKey: string;

  @Field({ description: 'Name der Zone' })
  name: string;

  @Field({ description: 'Anzahl der Minuten, die in der Zone verbracht werden müssen, um Punkte zu erhalten' })
  minutesRequired: number;

  @Field({ description: 'Anzahl der Punkte, die für das Erreichen der erforderlichen Zeit vergeben werden' })
  pointsGranted: number;

  @Field({ nullable: true, description: 'Zeitpunkt der letzten Nutzung der Zone' })
  lastUsageAt?: Date;

  @Field({ description: 'Gesamtzeit in Sekunden, die in dieser Zone verbracht wurde' })
  totalSecondsInZone: number;

  @Field({ description: 'Gibt an, ob die Zone in Discord gelöscht wurde' })
  isDeletedInDiscord: boolean;

  @Field({ description: 'ID der Kategorie, zu der diese Zone gehört' })
  categoryId: string;

  @Field(() => Category, { description: 'Die übergeordnete Kategorie dieser Zone' })
  category: Category;

  @Field({ nullable: true, description: 'Discord Voice Channel ID der Zone' })
  discordVoiceId?: string;

  @Field({ description: 'Erstellungszeitpunkt der Zone' })
  createdAt: Date;

  @Field({ description: 'Letzter Aktualisierungszeitpunkt der Zone' })
  updatedAt: Date;
}

/**
 * Input für die Erstellung einer neuen Zone
 */
@InputType({ description: 'Eingabedaten zum Erstellen einer Zone' })
export class ZoneCreateInput {
  @Field({ description: 'Kurzes Kürzel für die Zone' })
  zoneKey: string;

  @Field({ description: 'Name der Zone' })
  name: string;

  @Field({ description: 'Anzahl der Minuten, die in der Zone verbracht werden müssen' })
  minutesRequired: number;

  @Field({ description: 'Anzahl der Punkte, die vergeben werden' })
  pointsGranted: number;

  @Field({ nullable: true, description: 'Zeitpunkt der letzten Nutzung' })
  lastUsageAt?: Date;

  @Field({ defaultValue: 0, description: 'Gesamtzeit in Sekunden in dieser Zone' })
  totalSecondsInZone?: number;

  @Field({ defaultValue: false, description: 'Gibt an, ob die Zone in Discord gelöscht wurde' })
  isDeletedInDiscord?: boolean;

  @Field({ description: 'ID der Kategorie, zu der diese Zone gehört' })
  categoryId: string;
  
  @Field({ nullable: true, description: 'Discord Voice Channel ID der Zone' })
  discordVoiceId?: string;
}

/**
 * Input für die Aktualisierung einer bestehenden Zone
 */
@InputType({ description: 'Eingabedaten zum Aktualisieren einer Zone' })
export class ZoneUpdateInput {
  @Field({ nullable: true, description: 'Kurzes Kürzel für die Zone' })
  zoneKey?: string;

  @Field({ nullable: true, description: 'Name der Zone' })
  name?: string;

  @Field({ nullable: true, description: 'Anzahl der Minuten, die in der Zone verbracht werden müssen' })
  minutesRequired?: number;

  @Field({ nullable: true, description: 'Anzahl der Punkte, die vergeben werden' })
  pointsGranted?: number;

  @Field({ nullable: true, description: 'Zeitpunkt der letzten Nutzung' })
  lastUsageAt?: Date;

  @Field({ nullable: true, description: 'Gesamtzeit in Sekunden in dieser Zone' })
  totalSecondsInZone?: number;

  @Field({ nullable: true, description: 'Gibt an, ob die Zone in Discord gelöscht wurde' })
  isDeletedInDiscord?: boolean;

  @Field({ nullable: true, description: 'ID der Kategorie, zu der diese Zone gehört' })
  categoryId?: string;

  @Field({ nullable: true, description: 'Discord Voice Channel ID der Zone' })
  discordVoiceId?: string;
}

/**
 * Standardisierter Event-Typ für alle Zone-Events
 * Dies ersetzt alle spezifischen Event-Typen mit einer einzigen, flexiblen Event-Struktur
 */
@ObjectType({ description: 'Standard Zone Event Payload' })
export class ZoneEvent {
  @Field(() => ID, { description: 'Zone ID' })
  id: string;

  @Field({ description: 'Kategorie ID' })
  categoryId: string;

  @Field({ nullable: true, description: 'Zone Name' })
  name?: string;

  @Field({ nullable: true, description: 'Discord Voice Channel ID' })
  discordVoiceId?: string;

  @Field({ description: 'Event Zeitstempel' })
  timestamp: string;

  @Field({ description: 'Event Typ: created, updated, deleted, usw.' })
  eventType: string;
  
  @Field({ nullable: true, description: 'Optionale Fehlermeldung' })
  message?: string;
}

/**
 * Zone Cache Interface nur für interne Verwendung
 */
export interface ZoneCache {
  firstUpdateTime: number;
  lastUpdateTime: number;
  changeCount: number;
  cachedName: string;
}