SELECT 
  id,
  name,
  email,
  phone01,
  bornDate,
  DATE_FORMAT(bornDate, '%d/%m') AS aniversario
FROM Client
WHERE 
  bornDate IS NOT NULL
  AND DAY(bornDate) = DAY(CURDATE())
  AND MONTH(bornDate) = MONTH(CURDATE());
