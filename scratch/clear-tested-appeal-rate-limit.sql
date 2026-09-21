delete from public.gsa_auth_rate_limits
where bucket_key in (
  'bffa5bc35648dbb6b7fc9e4fb45a47c7d38c2dcd42559070510029fc85188792',
  '31d4a7f106260548d56b960db297ee2716ba1cbc5c9afae626d4ac674b36972d'
);
