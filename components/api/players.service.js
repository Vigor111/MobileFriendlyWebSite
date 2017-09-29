(function() {
    'use strict';

    angular.module('3pak')
        .service('$players', PlayersService);

    /**
     * handles players api actions
     * @param $api
     * @constructor
     */
    function PlayersService($api, $storage) {
        /**
         * storing the players request for future calls
         * @type {Q.Promise}
         * @private
         */
        var _playersPromise = null;
        /**
         * regex for parsing the first name
         * @type {RegExp}
         * @private
         */
        var _truncateNameRegex = /^(\w+)\s/;

        return {
            get:       getPlayers,
            transform: transformPlayer
        };

        /**
         * gets list of current players for the active game
         * @returns {Q.Promise}
         */
        function getPlayers() {
            var response = $api.get('current_week/').then(
                _check_week_or_fetch_player
            );
            return response;
        }

        function _check_week_or_fetch_player(response) {
            var localStoredData = $storage.getPlayerData();
            if (response.week == $storage.getCurrentWeek() && localStoredData) {
                _playersPromise = localStoredData;
            } else {
                $storage.setCurrentWeek(response.week);
                $storage.setStartDay(response.start_day);
                $storage.setEndDay(response.end_day);
                _playersPromise = $api.get('playergames/')
                    .then(_parsePlayerResponse);
            }
            return _playersPromise;
        }

        /**
         * takes raw api response and adds necessary properties to keep ui up-to-date
         * @param response - json response from api
         * @returns {Array} - with massaged data
         * @private
         */

        function _parsePlayerResponse(response) {
            var result = response.results
                .map(transformPlayer)
                .sort(_bySalary);
            $storage.setPlayerData(result);
            return result;
        }

        /**
         * runs several data transforming functions to normalize player data for ui
         * @param player
         * @returns {*}
         * @private
         */
        function transformPlayer(player) {
            if(player.player) {
                player = _addTeams(player);
                player = _truncateName(player);
            }
            //  temporary until score works for dashboard
            //  this is for defensive ridiculously long ppgs
            player = _normalizePPG(player);
            return player;
        }

        /**
         * determines teams by parsing api response data and giving a flag for bolding player's home team
         * @param player
         * @returns {*}
         * @private
         */
        function _addTeams(player) {
            var teams = player.game.vs.split(' ');
            player.game.home = teams[0];
            player.game.away = teams[2];
            player.fromHome = player.player.team.abbr === player.game.home;
            player.fromAway = player.player.team.abbr === player.game.away;
            return player;
        }

        /**
         * prettifies the player's name by reducing the first name to the first letter
         * @param player
         * @returns {*}
         * @private
         */
        function _truncateName(player) {
            try {
                var firstName = player.player.Name.match(_truncateNameRegex)[1];
                player.displayName = player.player.Name.replace(firstName, firstName.substr(0, 1) + '.');
            } catch(ignore) {
                //  in the event that there's weirdness with the name
                player.displayName = player.player.Name;
            }
            return player;
        }

        function _normalizePPG(player) {
            var ppg = player.FantasyPointsFanDuelProjection;
            player.FantasyPointsFanDuelProjection = Math.round(ppg * 100) / 100;
            return player;
        }

        function _bySalary(a, b) {
            return b.FanDuelSalary - a.FanDuelSalary;
        }
    }

}());