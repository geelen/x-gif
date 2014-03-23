macro => {
  rule infix { ($value (,) ...) | {$body ...} } => {
    function($value (,) ...) {
      $body ...
    }.bind(this)
  }
  rule infix { ($value (,) ...) | $guard:expr } => {
    function($value (,) ...) {
      return $guard;
    }.bind(this)
  }
  rule infix { $param:ident | $guard:expr } => {
    function($param) {
      return $guard;
    }
  }
}

macro H1 {
  rule {} => {
    React.DOM.h1
  }
}

macro DIV {
  rule {} => {
    React.DOM.div
  }
}

macro IMG {
  rule {} => {
    React.DOM.img
  }
}

export =>
export H1
export DIV
export IMG
