// Custom scrollbar bounds use the owner's actual border/padding, including
// CSS transforms during menu entry. Tracks stay in the inner padding gutter.
export function scrollTrackBox(rect,axis,style,{modal=false,close=false,scaleX=1,scaleY=1}={}){
 const px=k=>Math.max(0,parseFloat(style[k])||0),width=6*scaleX,height=6*scaleY;
 const left=rect.left+px('borderLeftWidth')*scaleX,right=rect.right-px('borderRightWidth')*scaleX;
 const top=rect.top+px('borderTopWidth')*scaleY,bottom=rect.bottom-px('borderBottomWidth')*scaleY;
 if(axis==='y'){
  const inset=modal?Math.max(8,px('paddingRight')*.38):4,start=top+(modal?Math.max(close?46:14,px('paddingTop')):5)*scaleY,end=bottom-(modal?Math.max(14,px('paddingBottom')):5)*scaleY;
  return{left:Math.max(left,right-(inset+6)*scaleX),top:Math.min(start,bottom),width:Math.max(0,Math.min(width,right-left)),height:Math.max(0,end-start)};
 }
 const start=left+(modal?Math.max(14,px('paddingLeft')):6)*scaleX,end=right-(modal?Math.max(14,px('paddingRight')):6)*scaleX;
 return{left:start,top:Math.max(top,bottom-(modal?Math.max(10,px('paddingBottom')*.4)+6:7)*scaleY),width:Math.max(0,end-start),height:Math.max(0,Math.min(height,bottom-top))};
}
