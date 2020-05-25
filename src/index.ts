import { config } from 'dotenv';
config();
import { Client, TextChannel } from 'discord.js';
import {
	elearningUrl,
	signUrl,
	ADMINS,
	CHANNEL_ID,
	CLOWN,
	CHECK_SIGN,
} from './conf.json';
import { printData, loadCalendar, MS_IN_HOUR, dateToString } from './utils';
import { ScheduledEvent } from './scheduledEvent';
import { sign } from './sign';
import { readFileSync, writeFileSync } from 'fs';

const client = new Client();
let events: ScheduledEvent[] = [];

interface Data {
	people: string[];
}

let data: Data = {
	people: [],
};

function loadData(): boolean {
	const d = JSON.parse(readFileSync('./data.json').toString()) as Data;
	data = d;
	console.log('Data loaded !');
	console.log(data);
	return true;
}

function saveData(): boolean {
	writeFileSync('./data.json', JSON.stringify(data));
	console.log('Data saved !');
	return true;
}

let norris: string[] = [];

function loadQuotes(): boolean {
	const qts = readFileSync('./norris.txt').toString();
	norris = qts.split('\n');
	return true;
}

// Gracefully handle closing
function close(): void {
	console.log('(^C kill.)');
	client.destroy();
	process.exit();
}

process.on('SIGINT', close);
process.on('SIGHUP', close);

function getPingChannel(): TextChannel {
	const channel = client.channels.cache.get(CHANNEL_ID);

	if(channel == null) {
		console.log('Error ping channel is null');
		close();
		process.exit();
	}

	return channel as TextChannel;
}

function getNext(i: number): ScheduledEvent | null {
	events = events.filter(e => !e.done);
	if(i < 0 || i >= events.length) {
		return null;
	}

	return events[i];
}

function cancel(i: number): ScheduledEvent | null {
	events = events.filter(e => !e.done);
	if(i < 0 || i >= events.length) {
		return null;
	}

	const e = events.splice(i, 1)[0];
	e.cancel();
	return e;
}

// BOT CONFIG

client.on('ready', async () => {
	if(client.user == null) {
		return;
	}
	console.log(`Logged in as ${client.user.tag}`);
	loadData();
	loadQuotes();

	const calendar = await loadCalendar(elearningUrl);
	console.log('Events:');
	printData(calendar);

	events = await Promise.all(calendar.map(ev => {
		if((ev.start == null) || (ev.end == null)) {
			return new Promise<ScheduledEvent>((r) => r());
		}

		const duration = ev.end.getTime() - ev.start.getTime();
		const e = new ScheduledEvent({
			name: 'Présence INFO2',
			description: `Go signer ${signUrl}!`,
			start: ev.start.getTime(),
			duration,
			channel: getPingChannel(),
			nbRemind: 2,
			intervalRemind: MS_IN_HOUR,
			people: data.people,
		});
		return e.load();
	}));

	console.log(`Prepared ${events.length} events !`);
});

client.on('message', async msg => {
	if(msg.author === client.user) {
		return;
	}

	if(msg.content.startsWith('.sign')) {
		if(msg.channel.type === 'dm') {
			const [name, pass] = msg.content.split(' ').slice(1);
			const fn = await sign(name, pass, msg.channel);
			if(fn != null) {
				msg.reply('Screenshot:', {
					files: [fn],
				});
			}
		}
		else {
			msg.reply('PAS ICI, EFFACE ! J\'AI DIT EN DM');
		}
		return;
	}
	
	if(msg.content.startsWith('.roll')) {
		const [m, n, lim] = /(\d)?d(\d*)/gm.exec(msg.content.split(' ').slice(1)[0]) || [null, null, null];
		if(lim) {
			msg.reply(new Array(+n || 1).fill(lim).map(x => Math.floor(Math.random() * x) + 1));
		} else {
			msg.reply('Syntax [nb]dX, avec nb = nombre de lancé, et dX le dé');
		}
	}

	// !\ DEBUGGING PURPOSE, DO NOT DO THIS AT HOME /!\\
	if(msg.channel.type === 'dm') {
		if (ADMINS.indexOf(msg.author.id) == -1) {
			return;
		}
		if(msg.content === '.save') {
			saveData();
			msg.reply('Saved !');
			return;
		}

		if(msg.content === '.close') {
			msg.reply('Closing bot ...');
			close();
			return;
		}

		if (msg.content.startsWith('.eval')) {
			eval(msg.content.split(' ').slice(1).join(' '));
		}

		if(msg.content.startsWith('.cancel')) {
			// Del the job too !
			const i = +msg.content.split(' ')[1] || 0;
			const e = cancel(i);
			if(e) {
				msg.reply('Deleted event !');
			}
			else {
				msg.reply(`No data index ${i}`);
			}
		}
	}

	// Ignore other channels
	// 308616236873285642 = debugging channel :smartcat:
	if(msg.channel.type !== 'dm' && msg.channel.id !== CHANNEL_ID && msg.channel.id != '308616236873285642') {
		return;
	}

	const id = msg.author.id;
	switch (msg.content) {
	// Subscription
	case '.pingme':
		if (!data.people.includes(id)) {
			data.people.push(id);
			msg.react(CHECK_SIGN);
		}
		else {
			msg.react(CLOWN);
		}
		break;
	// Unsubscription
	case '.unpingme':
		if (data.people.includes(id)) {
			data.people.splice(data.people.indexOf(id), 1);
			msg.react(CHECK_SIGN);
		}
		else {
			msg.react(CLOWN);
		}
		break;
	case '.all':
		// Change printData() to refactor this code:
		msg.reply(events.map(ev => {
			const end = new Date(ev.start + ev.duration);
			const start = new Date(ev.start);
			return `[${dateToString(start)}] to [${dateToString(end)}] (${ev.name})`;
		}).join('\n'));
		break;
	case '.norris':
		// Pour toi Guillaume :p
		// Extracted from: https://www.chucknorrisfacts.fr/facts/top
		// Via: [...document.querySelectorAll('.factbody')].map(x => x.innerText.trim().split('\nVotez')[0]).join('\n')
		msg.reply(norris[Math.floor(Math.random() * norris.length)]);
		break;
	// help
	case '.help':
		(await msg.reply('TODO...')).react(CLOWN);
		break;
	}

	if(msg.content.startsWith('.next')) {
		const i = +msg.content.split(' ')[1] || 0;
		const e = getNext(i);
		if(e) {
			msg.reply(e.toString());
		}
		else {
			msg.reply(`No data index ${i}`);
		}
	}

});

client.login(process.env.TOKEN || process.exit(1));
