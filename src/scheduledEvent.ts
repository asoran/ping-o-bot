import { scheduleJob, Job } from 'node-schedule';
import { Message, TextChannel, MessageReaction, User } from 'discord.js';
import { peopleToPingString, MS_IN_HOUR } from './utils';
import {
	CHANNEL_ID,
	SERVER_ID,
	CHECK_SIGN,
} from './conf.json';

interface ScheduledEventInfo {
	name: string;
	description: string;
	start: number;
	duration: number;
	nbRemind: number;
	intervalRemind?: number;
	channel: TextChannel;
	people: string[];
}

function CHECK_SIGN_FILTER(pops: string[]) {
	return (reaction: MessageReaction, user: User): boolean => {
		return CHECK_SIGN == reaction.emoji.name && pops.includes(user.id);
	};
}

export class ScheduledEvent implements ScheduledEventInfo {
	name: string;
	description: string;
	start: number;
	duration: number;
	nbRemind: number;
	intervalRemind: number;
	channel: TextChannel;
	people: string[];

	done = false;

	_pinged: string[] = [];
	message?: Message;
	job?: Job;
	reminders: Job[] = [];
	messageUrl?: string;

	constructor(data: ScheduledEventInfo) {
		this.name = data.name;
		this.description = data.description;
		this.start = data.start;
		this.duration = data.duration;
		this.nbRemind = data.nbRemind;
		this.intervalRemind = data.intervalRemind || MS_IN_HOUR;
		this.channel = data.channel;
		this.people = data.people;
	}

	cancel(): void {
		this.done = true;
		this.reminders.forEach(r => r.cancel());
		this.job?.cancel();
	}

	async load(): Promise<ScheduledEvent> {
		this.job = scheduleJob(this.start, async () => {
			// Ping people and create reaction collector
			this._pinged = this.people.map(x => x);

			this.message = await this.channel.send(
				`${this.name} (${this.description})\n${peopleToPingString(this._pinged)}`,
			);

			this.message.react(CHECK_SIGN);
			this.messageUrl = `https://discordapp.com/channels/${SERVER_ID}/${CHANNEL_ID}/${this.message.id}`;

			// Reminders:
			const remindeFunc = (): void => {
				this.channel.send(
					`[Rappel] ${this.name} (${this.description})\n${peopleToPingString(this._pinged)}\nValidez ici:${this.messageUrl}`,
				);
			};
			for(let i = 1; i <= this.nbRemind; ++i) {
				const date = new Date(this.start + this.intervalRemind * i);
				this.reminders.push(scheduleJob(new Date(date), remindeFunc));
			}

			// Reaction collector:
			const duration = this.duration;
			const col = this.message.createReactionCollector(CHECK_SIGN_FILTER(this._pinged), {
				time: duration,
			});

			col.on('collect', (r, u) => {
				// console.log(`Collected ${r.emoji.name} from ${u.tag}`);
				this._pinged.splice(this._pinged.indexOf(u.id), 1);
				if (this._pinged.length == 0) {
					col.stop();
				}
			});

			col.on('end', () => {
				// pingChannel.send('Collecting finished !');
				this.cancel();
				if (this._pinged.length != 0) {
					this.channel.send(
						`Vous avez oublier de répondre présent !:\n${peopleToPingString(this._pinged)}`,
					);
				}
				else {
					this.channel.send('Tout le monde a répondu présent !');
				}
			});
		});

		return this;
	}

	toString(): string {
		return `${this.name} (${this.description}) programmed at ${new Date(this.start).toLocaleTimeString('fr-FR')}`;
	}
}
