(function(angular) {
    'use strict';

    var app = angular.module('puzzleApp', ['slidingPuzzle']);

    var types = [
        { id: 'sliding-puzzle', title: 'Sliding puzzle' }
    ];

    
    app.config(function($routeProvider) {
        $routeProvider.when('/:type');
    });

    
    app.run(function($rootScope, $route, $filter) {
        $rootScope.types = types;
        $rootScope.type = types[0].id;

        // set type on route change
        $rootScope.$on('$routeChangeSuccess', function(event, route) {
            $rootScope.type = ($filter('filter')(types, { id: route.params.type }).length ? route.params.type : types[0].id);
        });
    });

    
    app.controller('slidingAdvancedCtrl', function($scope) {
        $scope.puzzles = [
            { src: './img/isentia.jpg', title: 'Isentia', rows: 3, cols: 3 }
        ];
    });

})(window.angular);