var app = angular.module('app', ['ui.bootstrap', 'bootstrapLightbox']);

app.config(function (LightboxProvider) {
  LightboxProvider.getImageUrl = function (image) {
    return '/images/' + image;
  };
});

/*Light box Feature & Graphics List*/
app.controller('GalleryCtrl', function ($scope, Lightbox, $http) {
$http.get('/api/pets')
  .then(function(res){
     $scope.images = res.data;
   });
  $scope.openLightboxModal = function (index) {
    Lightbox.openModal($scope.images, index);
  };

  $scope.delete = function (filename, index) {
    if (confirm("Are you sure you want to delete: \n\n" + filename + "?")) {
      $http.post('/delete', {"image": filename}).then(function successCallback(res){
        $scope.images.splice(index, 1);
      },
      function errorCallback(res){
        alert('Could not delete photo.  Please try again later.');
      });
    }
  };
});
