export const setToArray = (set: Set<string>, map: any) => {
  const uniqueLinkArray = Array.from(set);
  const date = new Date();
  let linksMapAsArr: { [x: string]: string }[] = [];
  map.set(date.toDateString(), uniqueLinkArray);
  map.forEach((v: string, k: string) => {
    linksMapAsArr = [...linksMapAsArr, { [k]: v }];
  });

  return linksMapAsArr;
};
