import { calculateOverall } from './src/utils/helpers.js';

const players = [
  { name: "Tim (0 CS, 0 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 0, motms: 0 },
  { name: "Tim (1 CS, 0 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 1, motms: 0 },
  { name: "Tim (2 CS, 0 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 2, motms: 0 },
  { name: "Tim (3 CS, 0 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 3, motms: 0 },
  { name: "Tim (0 CS, 1 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 0, motms: 1 },
  { name: "Tim (0 CS, 2 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 0, motms: 2 },
  { name: "Tim (0 CS, 3 MOTM)", goals: 0, wins: 1, gamesPlayed: 3, assists: 0, cleanSheets: 0, motms: 3 }
];

console.log("Testing Rating for 3 Games, 1 Win, 0 Goals, 0 Assists");
players.forEach(p => {
  console.log(`${p.name} => Rating: ${calculateOverall(p)}`);
});
