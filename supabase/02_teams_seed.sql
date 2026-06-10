-- ============================================================
-- Focal World Cup 2026 — seed the 48 teams (confirmed group draw)
-- Run AFTER 01_schema.sql. Check the list, then run the whole file.
-- ============================================================

insert into public.teams (name, code, flag, group_letter) values
-- Group A
('Mexico','MEX','🇲🇽','A'),
('South Africa','RSA','🇿🇦','A'),
('South Korea','KOR','🇰🇷','A'),
('Czechia','CZE','🇨🇿','A'),
-- Group B
('Canada','CAN','🇨🇦','B'),
('Bosnia and Herzegovina','BIH','🇧🇦','B'),
('Qatar','QAT','🇶🇦','B'),
('Switzerland','SUI','🇨🇭','B'),
-- Group C
('Brazil','BRA','🇧🇷','C'),
('Morocco','MAR','🇲🇦','C'),
('Haiti','HAI','🇭🇹','C'),
('Scotland','SCO','🏴󠁧󠁢󠁳󠁣󠁴󠁿','C'),
-- Group D
('United States','USA','🇺🇸','D'),
('Paraguay','PAR','🇵🇾','D'),
('Australia','AUS','🇦🇺','D'),
('Türkiye','TUR','🇹🇷','D'),
-- Group E
('Germany','GER','🇩🇪','E'),
('Curaçao','CUW','🇨🇼','E'),
('Ivory Coast','CIV','🇨🇮','E'),
('Ecuador','ECU','🇪🇨','E'),
-- Group F
('Netherlands','NED','🇳🇱','F'),
('Japan','JPN','🇯🇵','F'),
('Sweden','SWE','🇸🇪','F'),
('Tunisia','TUN','🇹🇳','F'),
-- Group G
('Belgium','BEL','🇧🇪','G'),
('Egypt','EGY','🇪🇬','G'),
('Iran','IRN','🇮🇷','G'),
('New Zealand','NZL','🇳🇿','G'),
-- Group H
('Spain','ESP','🇪🇸','H'),
('Cabo Verde','CPV','🇨🇻','H'),
('Saudi Arabia','KSA','🇸🇦','H'),
('Uruguay','URU','🇺🇾','H'),       -- football-data calls this URY; cron maps it
-- Group I
('France','FRA','🇫🇷','I'),
('Senegal','SEN','🇸🇳','I'),
('Iraq','IRQ','🇮🇶','I'),
('Norway','NOR','🇳🇴','I'),
-- Group J
('Argentina','ARG','🇦🇷','J'),
('Algeria','ALG','🇩🇿','J'),
('Austria','AUT','🇦🇹','J'),
('Jordan','JOR','🇯🇴','J'),
-- Group K
('Portugal','POR','🇵🇹','K'),
('DR Congo','COD','🇨🇩','K'),
('Uzbekistan','UZB','🇺🇿','K'),
('Colombia','COL','🇨🇴','K'),
-- Group L
('England','ENG','🏴󠁧󠁢󠁥󠁮󠁧󠁿','L'),
('Croatia','CRO','🇭🇷','L'),
('Ghana','GHA','🇬🇭','L'),
('Panama','PAN','🇵🇦','L');

-- Sanity check: should return 48 rows, 4 per group
select group_letter, count(*) from public.teams group by group_letter order by group_letter;
