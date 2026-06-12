require('dotenv').config({ path: '../server/.env' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// =====================================================================
// PREMIER LEAGUE DATA — iconische seizoenen
// Spelersformaat: [naam, positie, rating, pace, shooting, passing,
//                  dribbling, defending, physical, nationaliteit]
// =====================================================================

const SEASONS = [
  { year: '1995', label: '1994-95' },
  { year: '1996', label: '1995-96' },
  { year: '1999', label: '1998-99' },
  { year: '2004', label: '2003-04' },
  { year: '2005', label: '2004-05' },
  { year: '2008', label: '2007-08' },
  { year: '2012', label: '2011-12' },
  { year: '2014', label: '2013-14' },
  { year: '2016', label: '2015-16' },
  { year: '2017', label: '2016-17' },
  { year: '2018', label: '2017-18' },
  { year: '2020', label: '2019-20' },
];

const CLUB_SEASONS = [
  {
    club: 'Arsenal', country: 'Engeland', season: '2003-04', // The Invincibles
    players: [
      ['Jens Lehmann', 'GK', 87, 52, 12, 70, 14, 86, 82, 'Duitsland'],
      ['Stuart Taylor', 'GK', 72, 45, 10, 58, 12, 70, 74, 'Engeland'],
      ['Sol Campbell', 'CB', 88, 76, 45, 62, 55, 90, 92, 'Engeland'],
      ['Kolo Touré', 'CB', 84, 80, 42, 65, 62, 85, 86, 'Ivoorkust'],
      ['Martin Keown', 'CB', 80, 65, 35, 58, 48, 84, 84, 'Engeland'],
      ['Ashley Cole', 'LB', 86, 90, 55, 74, 76, 84, 78, 'Engeland'],
      ['Lauren', 'RB', 81, 80, 48, 70, 68, 81, 80, 'Kameroen'],
      ['Patrick Vieira', 'CDM', 91, 78, 70, 84, 80, 89, 92, 'Frankrijk'],
      ['Gilberto Silva', 'CDM', 84, 70, 58, 78, 70, 85, 84, 'Brazilië'],
      ['Edu', 'CM', 80, 68, 64, 80, 74, 72, 76, 'Brazilië'],
      ['Ray Parlour', 'CM', 78, 74, 60, 74, 70, 72, 78, 'Engeland'],
      ['Robert Pirès', 'LM', 89, 84, 84, 87, 90, 42, 64, 'Frankrijk'],
      ['Freddie Ljungberg', 'RM', 85, 84, 78, 80, 84, 55, 72, 'Zweden'],
      ['Dennis Bergkamp', 'CAM', 88, 72, 86, 92, 91, 38, 68, 'Nederland'],
      ['Thierry Henry', 'ST', 94, 96, 92, 84, 93, 30, 78, 'Frankrijk'],
      ['José Antonio Reyes', 'LW', 83, 88, 78, 76, 86, 32, 64, 'Spanje'],
      ['Sylvain Wiltord', 'ST', 82, 84, 80, 72, 80, 35, 70, 'Frankrijk'],
    ],
  },
  {
    club: 'Arsenal', country: 'Engeland', season: '2017-18',
    players: [
      ['Petr Čech', 'GK', 84, 46, 12, 66, 14, 84, 78, 'Tsjechië'],
      ['David Ospina', 'GK', 78, 50, 10, 60, 12, 77, 72, 'Colombia'],
      ['Laurent Koscielny', 'CB', 84, 76, 40, 68, 64, 86, 80, 'Frankrijk'],
      ['Shkodran Mustafi', 'CB', 80, 72, 38, 64, 58, 81, 82, 'Duitsland'],
      ['Nacho Monreal', 'LB', 81, 76, 52, 74, 72, 80, 74, 'Spanje'],
      ['Sead Kolašinac', 'LB', 78, 78, 50, 68, 66, 76, 86, 'Bosnië'],
      ['Héctor Bellerín', 'RB', 81, 93, 50, 72, 76, 76, 70, 'Spanje'],
      ['Granit Xhaka', 'CM', 80, 58, 70, 84, 72, 72, 78, 'Zwitserland'],
      ['Aaron Ramsey', 'CM', 82, 76, 76, 81, 80, 64, 74, 'Wales'],
      ['Jack Wilshere', 'CM', 78, 70, 64, 80, 84, 56, 64, 'Engeland'],
      ['Mesut Özil', 'CAM', 88, 70, 72, 93, 88, 28, 56, 'Duitsland'],
      ['Henrikh Mkhitaryan', 'RW', 83, 82, 78, 82, 85, 48, 68, 'Armenië'],
      ['Alex Iwobi', 'LW', 76, 80, 66, 74, 80, 38, 68, 'Nigeria'],
      ['Alexandre Lacazette', 'ST', 84, 82, 86, 74, 82, 32, 76, 'Frankrijk'],
      ['Pierre-Emerick Aubameyang', 'ST', 87, 94, 86, 74, 82, 32, 70, 'Gabon'],
      ['Danny Welbeck', 'ST', 78, 84, 72, 68, 76, 40, 76, 'Engeland'],
    ],
  },
  {
    club: 'Manchester United', country: 'Engeland', season: '1998-99', // The Treble
    players: [
      ['Peter Schmeichel', 'GK', 91, 55, 14, 70, 16, 90, 88, 'Denemarken'],
      ['Raimond van der Gouw', 'GK', 75, 44, 10, 58, 12, 73, 74, 'Nederland'],
      ['Jaap Stam', 'CB', 90, 80, 40, 66, 56, 92, 92, 'Nederland'],
      ['Ronny Johnsen', 'CB', 81, 74, 38, 64, 56, 83, 80, 'Noorwegen'],
      ['Gary Neville', 'RB', 84, 74, 48, 76, 64, 85, 78, 'Engeland'],
      ['Phil Neville', 'RB', 78, 74, 44, 70, 62, 78, 74, 'Engeland'],
      ['Denis Irwin', 'LB', 83, 76, 56, 76, 68, 84, 74, 'Ierland'],
      ['Roy Keane', 'CDM', 90, 74, 70, 84, 78, 88, 90, 'Ierland'],
      ['Paul Scholes', 'CM', 88, 68, 84, 90, 84, 60, 70, 'Engeland'],
      ['Nicky Butt', 'CM', 79, 70, 60, 74, 68, 76, 80, 'Engeland'],
      ['David Beckham', 'RM', 89, 74, 84, 94, 82, 56, 70, 'Engeland'],
      ['Ryan Giggs', 'LM', 89, 90, 78, 84, 92, 48, 66, 'Wales'],
      ['Jesper Blomqvist', 'LM', 77, 80, 62, 72, 78, 42, 62, 'Zweden'],
      ['Dwight Yorke', 'ST', 87, 84, 86, 78, 86, 36, 76, 'Trinidad en Tobago'],
      ['Andy Cole', 'ST', 86, 88, 87, 68, 80, 30, 72, 'Engeland'],
      ['Ole Gunnar Solskjær', 'ST', 84, 80, 87, 72, 78, 34, 66, 'Noorwegen'],
      ['Teddy Sheringham', 'ST', 82, 64, 82, 84, 78, 40, 72, 'Engeland'],
    ],
  },
  {
    club: 'Manchester United', country: 'Engeland', season: '2007-08',
    players: [
      ['Edwin van der Sar', 'GK', 88, 48, 12, 76, 16, 87, 80, 'Nederland'],
      ['Tomasz Kuszczak', 'GK', 77, 48, 10, 58, 12, 76, 76, 'Polen'],
      ['Rio Ferdinand', 'CB', 90, 80, 42, 74, 68, 91, 86, 'Engeland'],
      ['Nemanja Vidić', 'CB', 89, 72, 44, 62, 54, 92, 92, 'Servië'],
      ['John O\'Shea', 'CB', 78, 68, 44, 66, 58, 79, 80, 'Ierland'],
      ['Patrice Evra', 'LB', 85, 88, 50, 74, 76, 84, 80, 'Frankrijk'],
      ['Wes Brown', 'RB', 80, 74, 38, 64, 56, 82, 84, 'Engeland'],
      ['Owen Hargreaves', 'CDM', 82, 76, 62, 80, 74, 82, 78, 'Engeland'],
      ['Michael Carrick', 'CM', 84, 62, 66, 88, 76, 76, 72, 'Engeland'],
      ['Paul Scholes', 'CM', 85, 60, 80, 90, 80, 58, 66, 'Engeland'],
      ['Anderson', 'CM', 79, 78, 62, 76, 80, 64, 78, 'Brazilië'],
      ['Ryan Giggs', 'LM', 84, 78, 72, 84, 86, 48, 62, 'Wales'],
      ['Park Ji-sung', 'RM', 80, 84, 64, 74, 78, 66, 78, 'Zuid-Korea'],
      ['Cristiano Ronaldo', 'RW', 93, 94, 92, 80, 94, 32, 80, 'Portugal'],
      ['Nani', 'LW', 81, 88, 74, 74, 87, 36, 66, 'Portugal'],
      ['Wayne Rooney', 'ST', 89, 84, 88, 82, 86, 48, 84, 'Engeland'],
      ['Carlos Tévez', 'ST', 87, 82, 86, 78, 87, 42, 80, 'Argentinië'],
    ],
  },
  {
    club: 'Chelsea', country: 'Engeland', season: '2004-05', // Mourinho's 95-puntenmachine
    players: [
      ['Petr Čech', 'GK', 89, 52, 12, 68, 14, 89, 84, 'Tsjechië'],
      ['Carlo Cudicini', 'GK', 80, 48, 10, 60, 12, 79, 76, 'Italië'],
      ['John Terry', 'CB', 89, 68, 48, 68, 58, 91, 88, 'Engeland'],
      ['Ricardo Carvalho', 'CB', 86, 74, 40, 70, 66, 88, 80, 'Portugal'],
      ['William Gallas', 'CB', 84, 80, 42, 66, 60, 86, 82, 'Frankrijk'],
      ['Paulo Ferreira', 'RB', 81, 78, 44, 70, 66, 82, 76, 'Portugal'],
      ['Glen Johnson', 'RB', 78, 84, 50, 68, 70, 75, 76, 'Engeland'],
      ['Wayne Bridge', 'LB', 79, 80, 46, 70, 66, 78, 76, 'Engeland'],
      ['Claude Makélélé', 'CDM', 89, 70, 50, 80, 76, 92, 80, 'Frankrijk'],
      ['Frank Lampard', 'CM', 90, 74, 88, 88, 80, 66, 80, 'Engeland'],
      ['Tiago', 'CM', 80, 70, 68, 80, 74, 70, 78, 'Portugal'],
      ['Joe Cole', 'CAM', 82, 80, 72, 80, 88, 42, 62, 'Engeland'],
      ['Arjen Robben', 'RW', 87, 94, 82, 78, 92, 32, 60, 'Nederland'],
      ['Damien Duff', 'LW', 84, 90, 74, 76, 86, 38, 64, 'Ierland'],
      ['Didier Drogba', 'ST', 86, 84, 87, 70, 80, 38, 90, 'Ivoorkust'],
      ['Eiður Guðjohnsen', 'ST', 83, 74, 82, 80, 80, 42, 76, 'IJsland'],
      ['Mateja Kežman', 'ST', 78, 84, 76, 64, 76, 30, 66, 'Servië'],
    ],
  },
  {
    club: 'Chelsea', country: 'Engeland', season: '2016-17', // Conte's 3-4-3
    players: [
      ['Thibaut Courtois', 'GK', 88, 50, 12, 66, 14, 87, 84, 'België'],
      ['Asmir Begović', 'GK', 78, 48, 10, 58, 12, 77, 78, 'Bosnië'],
      ['David Luiz', 'CB', 84, 76, 56, 78, 70, 84, 82, 'Brazilië'],
      ['Gary Cahill', 'CB', 82, 70, 44, 62, 52, 84, 84, 'Engeland'],
      ['César Azpilicueta', 'CB', 85, 80, 48, 76, 70, 87, 78, 'Spanje'],
      ['Kurt Zouma', 'CB', 78, 80, 34, 58, 48, 79, 86, 'Frankrijk'],
      ['Marcos Alonso', 'LM', 81, 76, 66, 74, 72, 78, 82, 'Spanje'],
      ['Victor Moses', 'RM', 79, 86, 64, 70, 78, 66, 76, 'Nigeria'],
      ['N\'Golo Kanté', 'CDM', 89, 82, 56, 78, 78, 92, 84, 'Frankrijk'],
      ['Nemanja Matić', 'CDM', 84, 62, 58, 80, 74, 84, 88, 'Servië'],
      ['Cesc Fàbregas', 'CM', 85, 60, 74, 91, 82, 56, 66, 'Spanje'],
      ['Eden Hazard', 'LW', 90, 92, 82, 84, 94, 32, 66, 'België'],
      ['Pedro', 'RW', 84, 88, 78, 78, 86, 42, 62, 'Spanje'],
      ['Willian', 'RW', 82, 88, 74, 78, 86, 50, 64, 'Brazilië'],
      ['Diego Costa', 'ST', 88, 78, 88, 70, 80, 40, 90, 'Spanje'],
      ['Michy Batshuayi', 'ST', 77, 82, 78, 62, 74, 28, 76, 'België'],
    ],
  },
  {
    club: 'Liverpool', country: 'Engeland', season: '2013-14', // Suárez & het bijna-kampioenschap
    players: [
      ['Simon Mignolet', 'GK', 80, 50, 10, 58, 12, 80, 78, 'België'],
      ['Brad Jones', 'GK', 72, 44, 10, 54, 10, 70, 74, 'Australië'],
      ['Martin Škrtel', 'CB', 81, 74, 42, 58, 50, 83, 86, 'Slovakije'],
      ['Mamadou Sakho', 'CB', 80, 70, 36, 62, 56, 82, 84, 'Frankrijk'],
      ['Daniel Agger', 'CB', 80, 70, 44, 70, 60, 81, 78, 'Denemarken'],
      ['Kolo Touré', 'CB', 76, 70, 36, 60, 54, 78, 80, 'Ivoorkust'],
      ['Glen Johnson', 'RB', 79, 82, 52, 72, 74, 74, 74, 'Engeland'],
      ['Jon Flanagan', 'LB', 74, 76, 40, 62, 60, 74, 74, 'Engeland'],
      ['Steven Gerrard', 'CM', 88, 70, 86, 90, 80, 70, 80, 'Engeland'],
      ['Jordan Henderson', 'CM', 81, 78, 68, 80, 74, 70, 78, 'Engeland'],
      ['Joe Allen', 'CM', 76, 68, 56, 78, 74, 66, 64, 'Wales'],
      ['Lucas Leiva', 'CDM', 78, 64, 50, 74, 68, 80, 78, 'Brazilië'],
      ['Philippe Coutinho', 'CAM', 84, 80, 76, 82, 90, 40, 58, 'Brazilië'],
      ['Raheem Sterling', 'RW', 82, 92, 70, 72, 86, 36, 60, 'Engeland'],
      ['Luis Suárez', 'ST', 92, 86, 92, 80, 90, 42, 80, 'Uruguay'],
      ['Daniel Sturridge', 'ST', 86, 88, 86, 72, 84, 30, 70, 'Engeland'],
      ['Iago Aspas', 'ST', 74, 80, 70, 66, 74, 30, 60, 'Spanje'],
    ],
  },
  {
    club: 'Liverpool', country: 'Engeland', season: '2019-20', // Eindelijk kampioen
    players: [
      ['Alisson', 'GK', 90, 54, 14, 78, 16, 89, 84, 'Brazilië'],
      ['Adrián', 'GK', 76, 48, 10, 58, 12, 75, 76, 'Spanje'],
      ['Virgil van Dijk', 'CB', 91, 80, 60, 78, 70, 93, 92, 'Nederland'],
      ['Joe Gomez', 'CB', 81, 84, 34, 66, 60, 82, 80, 'Engeland'],
      ['Joël Matip', 'CB', 82, 72, 40, 70, 62, 84, 82, 'Kameroen'],
      ['Andrew Robertson', 'LB', 87, 88, 60, 82, 78, 82, 80, 'Schotland'],
      ['Trent Alexander-Arnold', 'RB', 87, 80, 66, 92, 80, 78, 72, 'Engeland'],
      ['Fabinho', 'CDM', 86, 70, 60, 80, 76, 88, 84, 'Brazilië'],
      ['Jordan Henderson', 'CM', 84, 74, 68, 84, 76, 76, 80, 'Engeland'],
      ['Georginio Wijnaldum', 'CM', 84, 78, 70, 82, 84, 72, 80, 'Nederland'],
      ['James Milner', 'CM', 79, 70, 66, 78, 72, 72, 76, 'Engeland'],
      ['Alex Oxlade-Chamberlain', 'CM', 80, 84, 74, 76, 80, 56, 72, 'Engeland'],
      ['Mohamed Salah', 'RW', 90, 93, 86, 80, 90, 42, 74, 'Egypte'],
      ['Sadio Mané', 'LW', 90, 94, 84, 78, 88, 42, 76, 'Senegal'],
      ['Roberto Firmino', 'ST', 87, 78, 80, 82, 88, 58, 76, 'Brazilië'],
      ['Divock Origi', 'ST', 77, 86, 74, 64, 76, 28, 76, 'België'],
    ],
  },
  {
    club: 'Manchester City', country: 'Engeland', season: '2011-12', // AGUEROOOO
    players: [
      ['Joe Hart', 'GK', 85, 52, 12, 62, 14, 85, 82, 'Engeland'],
      ['Costel Pantilimon', 'GK', 75, 42, 10, 54, 10, 74, 80, 'Roemenië'],
      ['Vincent Kompany', 'CB', 87, 74, 48, 70, 62, 89, 88, 'België'],
      ['Joleon Lescott', 'CB', 81, 68, 40, 62, 52, 84, 84, 'Engeland'],
      ['Gaël Clichy', 'LB', 81, 86, 44, 70, 72, 80, 74, 'Frankrijk'],
      ['Pablo Zabaleta', 'RB', 82, 78, 50, 72, 70, 83, 82, 'Argentinië'],
      ['Micah Richards', 'RB', 80, 84, 44, 64, 64, 80, 88, 'Engeland'],
      ['Yaya Touré', 'CM', 88, 76, 82, 84, 82, 78, 92, 'Ivoorkust'],
      ['Gareth Barry', 'CDM', 81, 62, 62, 80, 70, 80, 80, 'Engeland'],
      ['Nigel de Jong', 'CDM', 80, 68, 48, 74, 68, 84, 86, 'Nederland'],
      ['David Silva', 'CAM', 89, 76, 74, 92, 92, 38, 58, 'Spanje'],
      ['Samir Nasri', 'RW', 84, 80, 74, 84, 88, 40, 62, 'Frankrijk'],
      ['James Milner', 'LM', 80, 76, 68, 78, 74, 68, 78, 'Engeland'],
      ['Sergio Agüero', 'ST', 89, 88, 90, 76, 88, 28, 74, 'Argentinië'],
      ['Carlos Tévez', 'ST', 84, 80, 84, 76, 84, 40, 78, 'Argentinië'],
      ['Edin Džeko', 'ST', 83, 70, 84, 72, 76, 34, 84, 'Bosnië'],
      ['Mario Balotelli', 'ST', 82, 82, 86, 68, 80, 28, 84, 'Italië'],
    ],
  },
  {
    club: 'Manchester City', country: 'Engeland', season: '2017-18', // De Centurions (100 punten)
    players: [
      ['Ederson', 'GK', 86, 56, 14, 82, 18, 85, 84, 'Brazilië'],
      ['Claudio Bravo', 'GK', 80, 48, 12, 74, 14, 79, 74, 'Chili'],
      ['Vincent Kompany', 'CB', 83, 68, 44, 68, 58, 86, 84, 'België'],
      ['Nicolás Otamendi', 'CB', 84, 74, 44, 68, 60, 86, 86, 'Argentinië'],
      ['John Stones', 'CB', 81, 76, 38, 76, 66, 81, 78, 'Engeland'],
      ['Kyle Walker', 'RB', 84, 94, 50, 74, 76, 80, 82, 'Engeland'],
      ['Danilo', 'RB', 79, 86, 52, 72, 74, 76, 76, 'Brazilië'],
      ['Fabian Delph', 'LB', 79, 76, 58, 78, 76, 74, 74, 'Engeland'],
      ['Fernandinho', 'CDM', 86, 74, 64, 82, 80, 86, 82, 'Brazilië'],
      ['Kevin De Bruyne', 'CM', 91, 78, 86, 93, 86, 60, 76, 'België'],
      ['David Silva', 'CM', 89, 72, 72, 92, 90, 40, 58, 'Spanje'],
      ['İlkay Gündoğan', 'CM', 83, 68, 70, 86, 84, 64, 70, 'Duitsland'],
      ['Bernardo Silva', 'RW', 84, 82, 72, 84, 90, 50, 60, 'Portugal'],
      ['Raheem Sterling', 'LW', 85, 92, 78, 76, 88, 36, 62, 'Engeland'],
      ['Leroy Sané', 'LW', 86, 95, 78, 78, 86, 32, 70, 'Duitsland'],
      ['Sergio Agüero', 'ST', 89, 86, 92, 76, 88, 28, 74, 'Argentinië'],
      ['Gabriel Jesus', 'ST', 83, 86, 80, 72, 82, 36, 72, 'Brazilië'],
    ],
  },
  {
    club: 'Leicester City', country: 'Engeland', season: '2015-16', // Het 5000-tegen-1 sprookje
    players: [
      ['Kasper Schmeichel', 'GK', 82, 54, 12, 64, 14, 81, 80, 'Denemarken'],
      ['Mark Schwarzer', 'GK', 74, 40, 10, 56, 10, 73, 74, 'Australië'],
      ['Wes Morgan', 'CB', 80, 64, 38, 56, 46, 84, 88, 'Jamaica'],
      ['Robert Huth', 'CB', 80, 60, 40, 54, 42, 84, 90, 'Duitsland'],
      ['Christian Fuchs', 'LB', 79, 76, 54, 76, 66, 78, 78, 'Oostenrijk'],
      ['Danny Simpson', 'RB', 77, 76, 38, 62, 60, 78, 76, 'Engeland'],
      ['Ritchie De Laet', 'RB', 74, 78, 40, 60, 60, 73, 74, 'België'],
      ['N\'Golo Kanté', 'CDM', 87, 82, 52, 74, 76, 90, 82, 'Frankrijk'],
      ['Danny Drinkwater', 'CM', 81, 70, 64, 82, 74, 74, 76, 'Engeland'],
      ['Andy King', 'CM', 75, 70, 64, 70, 68, 64, 72, 'Wales'],
      ['Riyad Mahrez', 'RW', 87, 88, 80, 80, 92, 38, 56, 'Algerije'],
      ['Marc Albrighton', 'LM', 78, 78, 62, 80, 74, 58, 66, 'Engeland'],
      ['Jeffrey Schlupp', 'LM', 75, 88, 56, 64, 72, 56, 76, 'Ghana'],
      ['Jamie Vardy', 'ST', 88, 94, 86, 66, 78, 40, 80, 'Engeland'],
      ['Shinji Okazaki', 'CF', 79, 80, 74, 68, 74, 48, 76, 'Japan'],
      ['Leonardo Ulloa', 'ST', 76, 64, 74, 62, 66, 36, 82, 'Argentinië'],
      ['Demarai Gray', 'LW', 74, 88, 62, 64, 80, 30, 58, 'Engeland'],
    ],
  },
  {
    club: 'Tottenham Hotspur', country: 'Engeland', season: '2016-17', // Poch' beste ploeg
    players: [
      ['Hugo Lloris', 'GK', 88, 58, 12, 66, 14, 87, 80, 'Frankrijk'],
      ['Michel Vorm', 'GK', 79, 48, 10, 60, 12, 78, 74, 'Nederland'],
      ['Toby Alderweireld', 'CB', 87, 70, 46, 80, 62, 89, 82, 'België'],
      ['Jan Vertonghen', 'CB', 86, 72, 44, 76, 66, 88, 80, 'België'],
      ['Danny Rose', 'LB', 82, 88, 52, 72, 74, 80, 78, 'Engeland'],
      ['Ben Davies', 'LB', 78, 74, 46, 72, 66, 78, 76, 'Wales'],
      ['Kyle Walker', 'RB', 83, 94, 48, 72, 74, 79, 80, 'Engeland'],
      ['Kieran Trippier', 'RB', 79, 76, 54, 82, 72, 76, 70, 'Engeland'],
      ['Eric Dier', 'CDM', 81, 62, 56, 74, 64, 83, 84, 'Engeland'],
      ['Victor Wanyama', 'CDM', 81, 72, 54, 70, 66, 84, 90, 'Kenia'],
      ['Mousa Dembélé', 'CM', 84, 76, 62, 80, 88, 74, 86, 'België'],
      ['Christian Eriksen', 'CAM', 87, 74, 80, 90, 86, 50, 60, 'Denemarken'],
      ['Dele Alli', 'CAM', 86, 80, 82, 78, 84, 56, 76, 'Engeland'],
      ['Son Heung-min', 'LW', 84, 90, 84, 76, 84, 40, 68, 'Zuid-Korea'],
      ['Moussa Sissoko', 'RM', 78, 84, 60, 70, 74, 60, 84, 'Frankrijk'],
      ['Harry Kane', 'ST', 89, 74, 92, 80, 80, 42, 84, 'Engeland'],
      ['Vincent Janssen', 'ST', 75, 70, 74, 64, 68, 32, 80, 'Nederland'],
    ],
  },
  {
    club: 'Newcastle United', country: 'Engeland', season: '1995-96', // The Entertainers
    players: [
      ['Pavel Srníček', 'GK', 79, 50, 10, 58, 12, 78, 80, 'Tsjechië'],
      ['Shaka Hislop', 'GK', 76, 48, 10, 56, 10, 75, 80, 'Trinidad en Tobago'],
      ['Philippe Albert', 'CB', 82, 72, 56, 74, 66, 82, 82, 'België'],
      ['Steve Howey', 'CB', 79, 72, 36, 60, 50, 81, 80, 'Engeland'],
      ['Darren Peacock', 'CB', 78, 64, 34, 56, 44, 80, 84, 'Engeland'],
      ['John Beresford', 'LB', 78, 78, 46, 68, 64, 77, 74, 'Engeland'],
      ['Warren Barton', 'RB', 77, 76, 44, 68, 62, 76, 76, 'Engeland'],
      ['Steve Watson', 'RB', 75, 76, 46, 64, 62, 73, 76, 'Engeland'],
      ['Robert Lee', 'CM', 83, 76, 74, 80, 76, 66, 78, 'Engeland'],
      ['David Batty', 'CDM', 81, 68, 50, 78, 70, 84, 82, 'Engeland'],
      ['Lee Clark', 'CM', 76, 70, 62, 74, 70, 60, 68, 'Engeland'],
      ['Peter Beardsley', 'CAM', 86, 74, 82, 86, 88, 44, 64, 'Engeland'],
      ['David Ginola', 'LW', 88, 86, 78, 84, 93, 30, 70, 'Frankrijk'],
      ['Keith Gillespie', 'RW', 80, 90, 64, 72, 82, 38, 62, 'Noord-Ierland'],
      ['Les Ferdinand', 'ST', 88, 86, 88, 66, 78, 32, 88, 'Engeland'],
      ['Faustino Asprilla', 'ST', 84, 88, 80, 72, 88, 28, 74, 'Colombia'],
    ],
  },
  {
    club: 'Blackburn Rovers', country: 'Engeland', season: '1994-95', // SAS: Shearer & Sutton
    players: [
      ['Tim Flowers', 'GK', 83, 52, 10, 58, 12, 82, 80, 'Engeland'],
      ['Bobby Mimms', 'GK', 74, 44, 10, 52, 10, 72, 74, 'Engeland'],
      ['Colin Hendry', 'CB', 83, 72, 40, 58, 50, 86, 86, 'Schotland'],
      ['Henning Berg', 'CB', 81, 74, 36, 64, 56, 84, 78, 'Noorwegen'],
      ['Ian Pearce', 'CB', 76, 70, 36, 56, 46, 77, 80, 'Engeland'],
      ['Graeme Le Saux', 'LB', 83, 82, 56, 76, 72, 80, 76, 'Engeland'],
      ['Jeff Kenna', 'RB', 76, 76, 42, 64, 60, 75, 74, 'Ierland'],
      ['Tim Sherwood', 'CM', 81, 66, 66, 80, 72, 74, 80, 'Engeland'],
      ['Mark Atkins', 'CM', 75, 66, 60, 70, 64, 70, 74, 'Engeland'],
      ['Paul Warhurst', 'CDM', 75, 74, 56, 64, 62, 74, 80, 'Engeland'],
      ['Stuart Ripley', 'RM', 80, 84, 62, 76, 80, 48, 70, 'Engeland'],
      ['Jason Wilcox', 'LM', 80, 82, 64, 76, 78, 46, 66, 'Engeland'],
      ['Alan Shearer', 'ST', 92, 84, 94, 74, 78, 40, 90, 'Engeland'],
      ['Chris Sutton', 'ST', 85, 74, 84, 70, 74, 46, 86, 'Engeland'],
      ['Kevin Gallacher', 'ST', 78, 84, 74, 64, 74, 32, 64, 'Schotland'],
      ['Mike Newell', 'ST', 75, 72, 72, 62, 66, 36, 76, 'Engeland'],
    ],
  },
];

const ACHIEVEMENTS = [
  { name: 'Eerste Overwinning', description: 'Win je eerste battle.', icon: '🏆', condition: 'wins_1' },
  { name: 'Op Stoom', description: 'Win 10 battles.', icon: '🔥', condition: 'wins_10' },
  { name: 'Legende', description: 'Win 50 battles.', icon: '⭐', condition: 'wins_50' },
  { name: 'Winnende Reeks', description: 'Behaal een win streak van 5.', icon: '⚡', condition: 'streak_5' },
  { name: 'Hogere Klasse', description: 'Bereik 1500 ELO.', icon: '💎', condition: 'elo_1500' },
  { name: 'Veteraan', description: 'Speel 100 battles.', icon: '🎖️', condition: 'battles_100' },
  { name: 'Kampioen', description: 'Haal 90+ punten in een gesimuleerd seizoen.', icon: '🥇', condition: 'season_90' },
  { name: 'Centurion', description: 'Haal 100+ punten in een gesimuleerd seizoen.', icon: '💯', condition: 'season_100' },
  { name: 'Invincible', description: 'Blijf een heel seizoen ongeslagen.', icon: '🛡️', condition: 'unbeaten' },
  { name: 'GOAT', description: 'Het perfecte seizoen: 38 gewonnen, 0 gelijk, 0 verloren.', icon: '🐐', condition: 'perfect' },
  { name: 'Goalgetter', description: 'Scoor 100+ goals in één seizoen.', icon: '⚽', condition: 'goals_100' },
  { name: 'De Muur', description: 'Slik maximaal 20 goals in één seizoen.', icon: '🧱', condition: 'clean_defense' },
  { name: 'Reuzendoder', description: 'Versla een tegenstander met 200+ ELO meer dan jij.', icon: '🗡️', condition: 'giant_killer' },
  { name: 'Dynastie', description: 'Win 5 kampioenstitels in gesimuleerde seizoenen.', icon: '👑', condition: 'titles_5' },
];

// =====================================================================
// SEED
// =====================================================================

async function main() {
  console.log('🧹 Database leegmaken...');
  // Volgorde respecteert foreign keys
  await prisma.draftPick.deleteMany();
  await prisma.battleResult.deleteMany();
  await prisma.battleRound.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.battle.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.footballPlayer.deleteMany();
  await prisma.clubSeason.deleteMany();
  await prisma.season.deleteMany();
  await prisma.club.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seizoenen
  console.log('Seizoenen aanmaken...');
  const seasonByLabel = {};
  for (const s of SEASONS) {
    seasonByLabel[s.label] = await prisma.season.create({ data: s });
  }

  // 2. Clubs (uniek op naam)
  console.log('Clubs aanmaken...');
  const clubByName = {};
  for (const cs of CLUB_SEASONS) {
    if (!clubByName[cs.club]) {
      clubByName[cs.club] = await prisma.club.create({
        data: { name: cs.club, country: cs.country },
      });
    }
  }

  // 3. Club-seizoenen + spelers
  console.log('Club-seizoenen en spelers aanmaken...');
  let totalPlayers = 0;
  for (const cs of CLUB_SEASONS) {
    const season = seasonByLabel[cs.season];
    if (!season) throw new Error(`Onbekend seizoen: ${cs.season}`);

    const clubSeason = await prisma.clubSeason.create({
      data: { clubId: clubByName[cs.club].id, seasonId: season.id },
    });

    await prisma.footballPlayer.createMany({
      data: cs.players.map(([name, position, rating, pace, shooting, passing, dribbling, defending, physical, nationality]) => ({
        name, position, rating, pace, shooting, passing, dribbling, defending, physical, nationality,
        clubSeasonId: clubSeason.id,
      })),
    });
    totalPlayers += cs.players.length;
    console.log(`   ⚽ ${cs.club} ${cs.season} (${cs.players.length} spelers)`);
  }

  // 4. Achievements
  console.log('Achievements aanmaken...');
  await prisma.achievement.createMany({ data: ACHIEVEMENTS });

  // 5. Admin + testgebruikers
  console.log('Gebruikers aanmaken...');
  const adminHash = await bcrypt.hash('admin1234', 12);
  await prisma.user.create({
    data: {
      username: 'Admin',
      email: 'admin@footballrivals.be',
      passwordHash: adminHash,
      role: 'ADMIN',
      profile: { create: {} },
      leaderboard: { create: {} },
    },
  });

  const testUsers = [
    { username: 'testspeler1', email: 'speler1@test.be', password: 'test1234', elo: 1200 },
    { username: 'testspeler2', email: 'speler2@test.be', password: 'test1234', elo: 1050 },
    { username: 'ProGamer99', email: 'pro@test.be', password: 'test1234', elo: 1450 },
    { username: 'FootballFan', email: 'fan@test.be', password: 'test1234', elo: 980 },
    { username: 'DraftKing', email: 'king@test.be', password: 'test1234', elo: 1380 },
  ];
  for (const u of testUsers) {
    const hash = await bcrypt.hash(u.password, 12);
    await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        passwordHash: hash,
        profile: { create: { currentElo: u.elo, highestElo: u.elo } },
        leaderboard: { create: { elo: u.elo } },
      },
    });
  }

  console.log('\n🎉 Seed compleet!');
  console.log(`   Club-seizoenen: ${CLUB_SEASONS.length}`);
  console.log(`   Spelers: ${totalPlayers}`);
  console.log(`   Achievements: ${ACHIEVEMENTS.length}`);
  console.log(`   Gebruikers: ${testUsers.length + 1}`);
  console.log('\n📋 Testaccounts:');
  console.log('   admin@footballrivals.be / admin1234 (Admin)');
  testUsers.forEach(u => console.log(`   ${u.email} / ${u.password}`));
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
